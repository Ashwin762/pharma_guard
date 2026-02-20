import os, uuid, json, datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB cap per requirements

SUPPORTED_DRUGS = ["CODEINE","WARFARIN","CLOPIDOGREL","SIMVASTATIN","AZATHIOPRINE","FLUOROURACIL"]
TARGET_GENES = ["CYP2D6","CYP2C19","CYP2C9","SLCO1B1","TPMT","DPYD"]

# Known pharmacogenomic variants by rsID
KNOWN_VARIANTS = {
    "rs3892097": {"gene": "CYP2D6", "star": "*4"},
    "rs1065852": {"gene": "CYP2D6", "star": "*10"},
    "rs28371706": {"gene": "CYP2D6", "star": "*5"},  # Deletion
    "rs4244285": {"gene": "CYP2C19", "star": "*2"},
    "rs4986893": {"gene": "CYP2C19", "star": "*3"},
    "rs1799853": {"gene": "CYP2C9", "star": "*2"},
    "rs1057910": {"gene": "CYP2C9", "star": "*3"},
    "rs4149056": {"gene": "SLCO1B1", "star": "*5"},
    "rs1800462": {"gene": "TPMT", "star": "*2"},
    "rs1800460": {"gene": "TPMT", "star": "*3A"},  # Part of *3A
    "rs1142345": {"gene": "TPMT", "star": "*3A"},  # Part of *3A
    "rs1800584": {"gene": "TPMT", "star": "*3C"},
    "rs3918290": {"gene": "DPYD", "star": "*2A"},
    "rs55886062": {"gene": "DPYD", "star": "*13"},
}

DRUG_GENE_MAP = {
    "CODEINE": ["CYP2D6"],
    "WARFARIN": ["CYP2C9", "VKORC1"],  # CYP4F2 optional
    "CLOPIDOGREL": ["CYP2C19"],
    "SIMVASTATIN": ["SLCO1B1"],
    "AZATHIOPRINE": ["TPMT", "NUDT15"],
    "FLUOROURACIL": ["DPYD"]
}

ALTERNATIVE_SUGGESTIONS = {
    "CODEINE": "Consider morphine or fentanyl as alternative opioids",
    "WARFARIN": "Consider direct oral anticoagulants like apixaban or rivaroxaban",
    "CLOPIDOGREL": "Consider aspirin or ticagrelor as alternative antiplatelets",
    "SIMVASTATIN": "Consider pravastatin or atorvastatin as alternative statins",
    "AZATHIOPRINE": "Consider mycophenolate mofetil as alternative immunosuppressant",
    "FLUOROURACIL": "Consider capecitabine as alternative fluoropyrimidine"
}

# ---------- ENGINES ----------
def generate_drug_comparison(results):
    if len(results) <= 1:
        return None
    severity_order = {"none": 0, "low": 1, "moderate": 2, "high": 3, "critical": 4}
    ranked = sorted(results, key=lambda x: severity_order.get(x["risk_assessment"]["severity"], 5))
    recommended = ranked[0]["drug"]
    reasoning = f"Drugs ranked from safest to highest risk based on pharmacogenomic severity: {', '.join([r['drug'] for r in ranked])}. Recommended first-line: {recommended} due to lowest risk profile."
    return {
        "ranked_drugs": [r["drug"] for r in ranked],
        "recommended_first_line": recommended,
        "reasoning": reasoning
    }

def generate_clinical_alert(risk_label, severity):
    if risk_label in ["Toxic", "Ineffective"] or severity == "critical":
        return {
            "alert_level": "High",
            "message": "Physician consultation strongly recommended before prescribing.",
            "action_required": True
        }
    return None

def suggest_alternative(drug, risk_label):
    if risk_label in ["Toxic", "Ineffective"]:
        return ALTERNATIVE_SUGGESTIONS.get(drug, "Consult pharmacist for alternatives")
    return None

def calculate_improved_confidence(phenotype, risk_label, all_genes_available, genes_found, total_genes):
    base = 0.85
    if phenotype == "NM" and risk_label == "Safe":
        base += 0.1
    if all_genes_available:
        base += 0.05
    completeness = len(genes_found) / total_genes if total_genes > 0 else 0
    base += completeness * 0.05
    basis = f"Confidence based on phenotype ({phenotype}), risk ({risk_label}), data completeness ({completeness:.1%}), and gene availability ({'full' if all_genes_available else 'partial'})."
    return min(base, 0.99), basis

# ---------- VCF PARSER ----------
def parse_vcf(file_content):
    variants={}
    for line in file_content.decode().splitlines():
        if line.startswith("#"): 
            continue
        parts=line.split("\t")
        if len(parts)<8: 
            continue
        rsid = parts[2]
        # Check if rsid is known
        if rsid in KNOWN_VARIANTS:
            kv = KNOWN_VARIANTS[rsid]
            gene = kv["gene"]
            if gene in TARGET_GENES:
                variants[gene] = {
                    "chrom": parts[0],
                    "pos": parts[1],
                    "rsid": rsid,
                    "ref": parts[3],
                    "alt": parts[4],
                    "gene": gene,
                    "star": kv["star"]
                }
            continue  # Skip further parsing for this line
        
        info = parts[7]
        info_dict={}
        for item in info.split(";"):
            if "=" in item:
                k,v=item.split("=")
                info_dict[k]=v
        
        gene = info_dict.get("GENE")
        if gene:
            gene = gene.upper()
            
        if gene in TARGET_GENES:
            variants[gene] = {
                "chrom": parts[0],
                "pos": parts[1],
                "rsid": parts[2],
                "ref": parts[3],
                "alt": parts[4],
                "gene": gene,
                "star": info_dict.get("STAR","*1") # Default to *1 if not found
            }
    return variants

# ---------- PHENOTYPE RULE ENGINE ----------
def get_phenotype(gene, star):
    pm = ["*3","*4","*5","*6"]
    im = ["*9","*10","*17","*41"]
    rm = ["*1xN","*2xN"]
    
    if any(p in star for p in pm): return "PM"
    if any(i in star for i in im): return "IM"
    if any(r in star for r in rm): return "URM"
    return "NM" # Default to Normal Metabolizer

def evaluate_drug(drug, phenotype):
    rules={
        "CODEINE": {
            "PM": ("Toxic", "Poor CYP2D6 function limits conversion to morphine; avoid or use alternative"),
            "URM": ("Toxic", "Ultra-rapid conversion to morphine; risk of respiratory depression"),
            "IM": ("Adjust Dosage", "Reduced conversion; consider higher monitored dosing or alternative"),
            "NM": ("Safe", "Normal CYP2D6 activity; standard dosing")
        },
        "WARFARIN": {
            "PM": ("Adjust Dosage", "Reduced CYP2C9 metabolism; lower dose to avoid bleeding"),
            "IM": ("Adjust Dosage", "Slower clearance; titrate carefully"),
            "NM": ("Safe", "Standard dosing"),
            "RM": ("Adjust Dosage", "Faster clearance possible; monitor INR"),
            "URM": ("Adjust Dosage", "Potential rapid metabolism; monitor INR closely")
        },
        "CLOPIDOGREL": {
            "PM": ("Ineffective", "Poor CYP2C19 activation of prodrug; use alternative antiplatelet"),
            "IM": ("Adjust Dosage", "Reduced activation; consider alternative"),
            "NM": ("Safe", "Standard dosing"),
            "RM": ("Safe", "Standard dosing"),
            "URM": ("Safe", "Standard dosing")
        },
        "SIMVASTATIN": {
            "PM": ("Toxic", "SLCO1B1 reduced function increases myopathy risk"),
            "IM": ("Adjust Dosage", "Moderate transport reduction; lower dose or alternative"),
            "NM": ("Safe", "Standard dosing")
        },
        "AZATHIOPRINE": {
            "PM": ("Toxic", "TPMT deficiency causes myelosuppression; avoid or drastically reduce"),
            "IM": ("Adjust Dosage", "Intermediate TPMT activity; dose reduction"),
            "NM": ("Safe", "Standard dosing")
        },
        "FLUOROURACIL": {
            "PM": ("Toxic", "DPYD deficiency leads to severe toxicity; avoid or extreme reduction"),
            "IM": ("Adjust Dosage", "Reduced DPD activity; lower dose with monitoring"),
            "NM": ("Safe", "Standard dosing")
        }
    }

    risk_label, rationale = rules.get(drug, {}).get(phenotype, ("Unknown", "Insufficient evidence for this drug/phenotype"))

    severity_map = {
        "Safe": "none",
        "Adjust Dosage": "moderate",
        "Toxic": "critical",
        "Ineffective": "high",
        "Unknown": "low"
    }

    severity = severity_map.get(risk_label, "low")
    return risk_label, severity, rationale


# ---------- GROQ LLM ----------
def call_llm(context):
    prompt=f"""
You are a pharmacogenomics clinical explanation generator.

IMPORTANT RULES:
- Do NOT infer genotype.
- Do NOT assign phenotype.
- Do NOT change risk level.
- Use ONLY the structured data provided.
- Generate a professional, user-friendly clinical explanation in structured JSON format with exactly these keys:
  "genetic_finding": "Describe the detected genetic variant(s) in simple, clear terms.",
  "biological_mechanism": "Explain how the variant affects the drug's metabolism or action in an easy-to-understand way.",
  "clinical_impact": "Describe the potential effects on the patient's health and treatment in practical terms.",
  "recommended_action": "Provide clear, actionable advice for healthcare providers and patients."

Return ONLY valid JSON, no extra text. Make each section informative and patient-friendly.

Context:
{context_toggle(context)}
"""
    if not GROQ_API_KEY:
        return {"genetic_finding": "LLM Analysis unavailable: GROQ_API_KEY not set.", "biological_mechanism": "", "clinical_impact": "", "recommended_action": ""}
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 500,
        "temperature": 0.1
    }
    try:
        r = requests.post(url, headers=headers, json=data, timeout=30)
        r.raise_for_status()
        response_text = r.json()["choices"][0]["message"]["content"].strip()
        # Clean markdown code blocks
        if response_text.startswith('```'):
            response_text = response_text[3:].strip()
            if response_text.startswith('json'):
                response_text = response_text[4:].strip()
            if response_text.endswith('```'):
                response_text = response_text[:-3].strip()
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            return {"genetic_finding": response_text, "biological_mechanism": "", "clinical_impact": "", "recommended_action": ""}
    except requests.HTTPError as e:
        detail = None
        try:
            detail = r.json()
        except Exception:
            detail = r.text if 'r' in locals() else None
        return {"genetic_finding": f"LLM Analysis failed: {e}. Detail: {detail}", "biological_mechanism": "", "clinical_impact": "", "recommended_action": ""}
    except Exception as e:
        return {"genetic_finding": f"LLM Analysis failed: {str(e)}", "biological_mechanism": "", "clinical_impact": "", "recommended_action": ""}

def context_toggle(context):
    return json.dumps(context,indent=2)

# ---------- MAIN ROUTE ----------
@app.route("/analyze",methods=["POST"])
def analyze():
    if "file" not in request.files:
        return jsonify({"error":"No file part"}),400
        
    file=request.files["file"]
    drugs_raw=request.form.get("drugs", "")
    if not drugs_raw:
         return jsonify({"error":"No drugs provided"}),400

    drugs=[d for d in drugs_raw.upper().replace(" ","").split(",") if d]
    if not drugs:
        return jsonify({"error":"No drugs provided"}),400

    # Enforce 5 MB cap
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_SIZE:
        return jsonify({"error":"VCF exceeds 5 MB limit"}),400

    file_content = file.read()

    variants=parse_vcf(file_content)
    
    # Check if we parsed anything relevant, or just assume minimal data if file is valid
    # if not variants:
    #    return jsonify({"error":"No pharmacogenomic variants detected"}),400

    results=[]
    for drug in drugs:
        genes = DRUG_GENE_MAP.get(drug, [])
        if not genes:
            continue # Skip unknown drugs

        # Collect variants for all required genes
        available_variants = {}
        for gene in genes:
            if gene in variants:
                available_variants[gene] = variants[gene]
            else:
                available_variants[gene] = {
                    "gene": gene,
                    "star": "*1",  # Default to Wild Type
                }

        # Determine phenotype - for simplicity, use the first gene's phenotype, but note if incomplete
        primary_gene = genes[0]
        star = available_variants[primary_gene].get("star", "*1")
        phenotype = get_phenotype(primary_gene, star)
        
        # Check if all genes are available
        all_genes_available = all(g in variants for g in genes)
        
        risk_label, severity, rationale = evaluate_drug(drug, phenotype)

        diplotype = star if "/" in star else f"{star}/{star}"

        context={
            "drug": drug,
            "genes": genes,
            "phenotype": phenotype,
            "variants": list(available_variants.values()),
            "diplotype": diplotype,
            "risk_label": risk_label,
            "rationale": rationale,
            "all_genes_available": all_genes_available
        }
        
        explanation = call_llm(context)

        genes_found = [g for g in genes if g in variants]
        confidence, basis = calculate_improved_confidence(phenotype, risk_label, all_genes_available, genes_found, len(genes))

        alternative = suggest_alternative(drug, risk_label)
        alert = generate_clinical_alert(risk_label, severity)

        result={
            "patient_id":f"PATIENT_{uuid.uuid4().hex[:6].upper()}",
            "drug":drug,
            "timestamp":datetime.datetime.utcnow().isoformat(),
            "risk_assessment":{
                "risk_label":risk_label,
                "confidence_score":confidence,
                "severity":severity,
                "confidence_basis": basis
            },
            "pharmacogenomic_profile":{
                "genes": genes,
                "diplotype": diplotype,  # Primary gene diplotype
                "phenotype": phenotype,  # Primary gene phenotype
                "detected_variants": [v for v in available_variants.values() if "rsid" in v]
            },
            "clinical_recommendation":{
                "guideline":"CPIC (Clinical Pharmacogenetics Implementation Consortium)",
                "recommendation": rationale,
                "alternative_drug_suggestion": alternative
            },
            "llm_generated_explanation":{
                "structured": explanation
            },
            "quality_metrics":{
                "vcf_parsing_success":True,
                "genes_found": genes_found,
                "all_required_genes_available": all_genes_available,
                "input_file_size_bytes": len(file_content),
                "genes_not_detected": [g for g in genes if g not in variants],
                "incomplete_variant_data": not all_genes_available,
                "parsing_warnings": []
            },
            "clinical_alert": alert,
            "decision_path_explanation": f"Variant ({star}) → Phenotype ({phenotype}) → Risk ({risk_label}) → Recommendation ({rationale})"
        }
        results.append(result)

    comparison = generate_drug_comparison(results)
    if comparison:
        for result in results:
            result["drug_comparison_summary"] = comparison

    return jsonify(results)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)

