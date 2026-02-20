import { useState, useRef } from "react"
import axios from "axios"
import { motion, AnimatePresence } from "framer-motion"
import {
  UploadCloud,
  FileText,
  X,
  AlertTriangle,
  Brain,
  Copy,
  Download,
  ShieldCheck,
  Globe2,
  Database,
  Lock,
  Sparkles,
  FileCheck2,
  Clock3,
  BarChart3,
  Info
} from "lucide-react"
import "./App.css"

export default function App() {
  const [file, setFile] = useState(null)
  const [drugs, setDrugs] = useState([])
  const [inputValue, setInputValue] = useState("")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const analyzerRef = useRef(null)

  const supportedDrugs = ["CODEINE", "WARFARIN", "CLOPIDOGREL", "SIMVASTATIN", "AZATHIOPRINE", "FLUOROURACIL"]

  const schemaSample = {
    patient_id: "PATIENT_ABC123",
    drug: "WARFARIN",
    timestamp: "2026-02-19T10:00:00Z",
    risk_assessment: {
      risk_label: "Adjust Dosage",
      confidence_score: 0.95,
      severity: "moderate"
    },
    pharmacogenomic_profile: {
      primary_gene: "CYP2C9",
      diplotype: "*2/*3",
      phenotype: "IM",
      detected_variants: [
        { rsid: "rs1799853", gene: "CYP2C9", star: "*2" },
        { rsid: "rs1057910", gene: "CYP2C9", star: "*3" }
      ]
    },
    clinical_recommendation: {
      guideline: "CPIC",
      recommendation: "Lower initial dose; monitor INR closely"
    },
    llm_generated_explanation: {
      summary: "CYP2C9 *2/*3 reduces S-warfarin clearance, increasing bleeding risk. Use reduced dosing with INR monitoring."
    },
    quality_metrics: {
      vcf_parsing_success: true,
      gene_found: true,
      input_file_size_bytes: 102400
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleDrugInput = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addDrug()
    }
  }
  
  const addDrug = () => {
    // Support comma-separated entry; also trims and uppercases
    const entries = inputValue
      .split(",")
      .map(v => v.trim().toUpperCase())
      .filter(Boolean)

    if (entries.length === 0) return

    const merged = Array.from(new Set([...drugs, ...entries]))
    setDrugs(merged)
    setInputValue("")
  }

  const removeDrug = (drug) => {
    setDrugs(drugs.filter(d => d !== drug))
  }

  const submit = async () => {
    // Build an updated list that includes any pending text
    let currentDrugs = drugs
    if (inputValue.trim()) {
      const pending = inputValue
        .split(",")
        .map(v => v.trim().toUpperCase())
        .filter(Boolean)
      currentDrugs = Array.from(new Set([...drugs, ...pending]))
      setDrugs(currentDrugs)
      setInputValue("")
    }

    if (!file) {
      setError("Please select a VCF file.")
      return
    }
    if (currentDrugs.length === 0) {
      setError("Please enter at least one drug.")
      return
    }

    setError(null)
    setResult(null)
    setLoading(true)

    const form = new FormData()
    form.append("file", file)
    form.append("drugs", currentDrugs.join(","))

    try {
      const res = await axios.post("https://pharma-guard-ux1e.onrender.com/analyze", form)

      setResult(res.data)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || "An error occurred during analysis. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const downloadJSON = (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmaguard_report_${data.patient_id}.json`;
    a.click();
  }

  const scrollToAnalyzer = () => {
    if (analyzerRef.current) {
      analyzerRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const getRiskColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case "none": return "risk-safe"
      case "low": return "risk-safe"
      case "moderate": return "risk-moderate"
      case "high": return "risk-toxic"
      case "critical": return "risk-toxic"
      default: return "risk-unknown"
    }
  }

  return (
    <div className="app-container">
      <div className="bg-glow" />
      <header className="header">
        <div className="brand">PharmaGuard</div>
        <nav>
          <a onClick={scrollToAnalyzer}>Analyze</a>
          <a href="#schema">Schema</a>
          <a href="#security">Security</a>
          <a href="#faq">FAQ</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <ShieldCheck size={16} /> Precision Medicine Algorithm
          </div>
          <h2>THE FUTURISTIC AI FOR PHARMACOGENOMICS</h2>
          <p className="hero-subtext">
            Empower clinicians with genomic-driven prescribing—upload VCF v4.2, choose drugs, and receive CPIC-aligned recommendations with explainable AI.
          </p>
          <div className="hero-cta">
            <button className="analyze-btn" onClick={scrollToAnalyzer}>
              <Brain size={18} /> Get Started
            </button>
            <button className="ghost-btn" onClick={() => navigator.clipboard.writeText(JSON.stringify(schemaSample, null, 2))}>
              <FileCheck2 size={18} /> Copy JSON Schema
            </button>
          </div>
          <div className="hero-tags">
            <span><Lock size={14} /> HIPAA-aware design</span>
            <span><Globe2 size={14} /> VCF v4.2</span>
            <span><Sparkles size={14} /> Explainable AI</span>
          </div>
        </div>
        
          
        
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <BarChart3 size={18} />
          <div>
            <p className="stat-value">100k+</p>
            <p className="stat-label">Annual ADR deaths that PGx can help avoid</p>
          </div>
        </div>
        <div className="stat-card">
          <Clock3 size={18} />
          <div>
            <p className="stat-value">Sub-10s</p>
            <p className="stat-label">Typical end-to-end analysis</p>
          </div>
        </div>
        <div className="stat-card">
          <ShieldCheck size={18} />
          <div>
            <p className="stat-value">CPIC-aligned</p>
            <p className="stat-label">Evidence-based recommendations</p>
          </div>
        </div>
      </section>

      <AnimatePresence>
      {!result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="glass-panel"
          ref={analyzerRef}
        >
          <div className="panel-heading">
            <div>
              <p className="section-label">Precision Medicine Workflow</p>
              <h3 className="panel-title">Upload VCF, select drugs, get AI explanations</h3>
              <p className="panel-subtitle">Validated for VCF v4.2 with INFO tags (GENE, STAR, RS). Max 5 MB per file.</p>
            </div>
            <div className="pill-list">
              <span className="pill"><Database size={14} /> VCF parser</span>
              <span className="pill"><Brain size={14} /> LLM explainability</span>
              <span className="pill"><ShieldCheck size={14} /> CPIC rules</span>
            </div>
          </div>

          <div className="input-grid">
            {/* File Upload Section */}
            <div>
              <span className="section-label">1. Upload Genomic Data</span>
              <div 
                className={`drop-zone ${file ? 'active' : ''}`}
                onClick={() => fileInputRef.current.click()}
              >
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".vcf" 
                  onChange={handleFileChange} 
                  hidden
                />
                
                {!file ? (
                  <>
                    <UploadCloud className="upload-icon" />
                    <p style={{fontWeight: 500, color: 'var(--text-main)'}}>
                      Click to upload VCF file
                    </p>
                    <p style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>
                      Supports VCF v4.2 format (max 5MB)
                    </p>
                  </>
                ) : (
                  <div className="file-preview">
                    <FileText className="upload-icon" />
                    <div className="file-info">
                      {file.name}
                      <button 
                        className="remove-file"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drug Input Section */}
            <div>
              <span className="section-label">2. Select Medications</span>
              <div className="drug-input-wrapper">
                <div className="drug-chips">
                  {drugs.map(drug => (
                    <motion.span 
                      key={drug}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="chip"
                    >
                      {drug}
                      <button onClick={() => removeDrug(drug)}><X size={14} /></button>
                    </motion.span>
                  ))}
                </div>
                
                <div style={{position: 'relative'}}>
                  <input 
                    type="text" 
                    className="text-input"
                    placeholder="Type drug name and press Enter (e.g. Warfarin)"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleDrugInput}
                    list="drug-suggestions"
                  />
                  <datalist id="drug-suggestions">
                    {supportedDrugs.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
                
                <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>
                  Supported: {supportedDrugs.join(", ")}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="error-message"
              style={{
                background: '#fee2e2', 
                color: '#991b1b', 
                padding: '1rem', 
                borderRadius: '0.5rem',
                marginTop: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <AlertTriangle size={20} />
              {error}
            </motion.div>
          )}

          <button 
            className="analyze-btn"
            onClick={submit}
            disabled={loading || !file || (drugs.length === 0 && !inputValue.trim())}
          >
            <Brain size={20} />
            Generate Risk Analysis
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <h3 style={{margin: '0 0 0.5rem', color: 'var(--primary)'}}>Analyzing Genomic Profile</h3>
          <p style={{color: 'var(--text-muted)'}}>Consulting CPIC guidelines & generating explanations...</p>
        </div>
      )}

      {result && (
        <motion.div 
          className="results-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="results-header">
            <div>
              <p className="section-label">Clinical Report</p>
              <h3 className="panel-title">Personalized pharmacogenomic insights</h3>
              <p className="panel-subtitle">Structured JSON output with risk, phenotype, diplotype, and explainable AI narrative.</p>
            </div>
            <button 
              className="action-btn" 
              style={{width: 'auto'}}
              onClick={() => { setResult(null); setFile(null); setDrugs([]); setInputValue(""); scrollToAnalyzer(); }}
            >
              Start New Analysis
            </button>
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
            <div className="pill-list">
              <span className="pill"><Info size={14} /> JSON schema compliant</span>
              <span className="pill"><ShieldCheck size={14} /> CPIC aligned</span>
              <span className="pill"><Brain size={14} /> LLM explanations</span>
            </div>
          </div>
          
          <div className="results-grid">
            {result.map((r, i) => (
              <motion.div 
                key={i} 
                className="result-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="card-header">
                  <h3 className="drug-name">{r.drug}</h3>
                  <span className={`risk-badge ${getRiskColor(r.risk_assessment.severity)}`}>
                    {r.risk_assessment.risk_label}
                  </span>
                </div>
                
                {r.clinical_alert && (
                  <div className="alert-banner">
                    <AlertTriangle size={16} /> {r.clinical_alert.message}
                  </div>
                )}
                
                <div className="card-body">
                  <div className="metric-grid">
                    <div className="metric-item">
                      <span className="metric-label">Gene</span>
                      <span className="metric-value">{r.pharmacogenomic_profile.genes.join(', ')}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Phenotype</span>
                      <span className="metric-value">{r.pharmacogenomic_profile.phenotype}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Diplotype</span>
                      <span className="metric-value">{r.pharmacogenomic_profile.diplotype}</span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-label">Confidence</span>
                      <span className="metric-value">{(r.risk_assessment.confidence_score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  
                  <div className="explanation-box">
                    <div className="explanation-title">
                      <Brain size={16} />
                      <span>AI Clinical Explanation</span>
                    </div>
                    <div className="structured-explanation">
                      <p><strong>Genetic Finding:</strong> {r.llm_generated_explanation.structured.genetic_finding}</p>
                      <p><strong>Biological Mechanism:</strong> {r.llm_generated_explanation.structured.biological_mechanism}</p>
                      <p><strong>Clinical Impact:</strong> {r.llm_generated_explanation.structured.clinical_impact}</p>
                      <p><strong>Recommended Action:</strong> {r.llm_generated_explanation.structured.recommended_action}</p>
                    </div>
                  </div>

                  {r.clinical_recommendation.alternative_drug_suggestion && (
                    <div className="alternative-box">
                      <p><strong>Alternative Suggestion:</strong> {r.clinical_recommendation.alternative_drug_suggestion}</p>
                    </div>
                  )}

                  {r.drug_comparison_summary && (
                    <div className="comparison-box">
                      <p><strong>Drug Comparison:</strong> {r.drug_comparison_summary.reasoning}</p>
                      <p><strong>Recommended First-Line:</strong> {r.drug_comparison_summary.recommended_first_line}</p>
                    </div>
                  )}

                  <div className="research-details">
                    <p><strong>Confidence Basis:</strong> {r.risk_assessment.confidence_basis}</p>
                    <p><strong>Decision Path:</strong> {r.decision_path_explanation}</p>
                    <p><strong>Quality Metrics:</strong> Genes found: {r.quality_metrics.genes_found.join(', ')}, Not detected: {r.quality_metrics.genes_not_detected.join(', ')}</p>
                  </div>
                </div>

                <div className="card-actions">
                  <button 
                    className="action-btn"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(r, null, 2))}
                    title="Copy JSON"
                  >
                    <Copy size={16} /> Copy
                  </button>
                  <button 
                    className="action-btn"
                    onClick={() => downloadJSON(r)}
                    title="Download Report"
                  >
                    <Download size={16} /> Save
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <section className="grid-two">
        <div className="card-lite" id="security">
          <div className="card-lite-header">
            <ShieldCheck size={18} /> Security & Compliance
          </div>
          <ul className="list-muted">
            <li>Your genetic data remains on your device during the upload process. We send a single secure request to our analysis server.</li>
            <li>VCF files are limited to 5 MB and must include specific genetic information tags.</li>
            <li>We use advanced AI for explanations, and any issues are clearly displayed.</li>
          </ul>
        </div>
        <div className="card-lite" id="schema">
          <div className="card-lite-header">
            <FileCheck2 size={18} /> Output Schema (strict)
          </div>
          <pre className="schema-block">{JSON.stringify(schemaSample, null, 2)}</pre>
        </div>
      </section>

      <section className="grid-two">
        <div className="card-lite">
          <div className="card-lite-header">
            <Database size={18} /> Supported Genes & Drugs
          </div>
          <p className="panel-muted">Genes: CYP2D6, CYP2C19, CYP2C9, SLCO1B1, TPMT, DPYD</p>
          <p className="panel-muted">Drugs: CODEINE, WARFARIN, CLOPIDOGREL, SIMVASTATIN, AZATHIOPRINE, FLUOROURACIL</p>
        </div>
        <div className="card-lite">
          <div className="card-lite-header">
            <Lock size={18} /> Operational Notes
          </div>
          <ul className="list-muted">
            <li>Phenotypes: PM, IM, NM, RM, URM mapping to severity bands.</li>
            <li>Risk labels: Safe, Adjust Dosage, Toxic, Ineffective, Unknown.</li>
            <li>Quality metrics include parse success and file size bytes.</li>
          </ul>
        </div>
      </section>

      <section className="faq" id="faq">
        <h3 className="panel-title">FAQ</h3>
        <div className="faq-item">
          <p className="faq-q">What if the AI explanation system fails?</p>
          <p className="faq-a">If there's an issue with generating the AI-powered explanation, you'll see a clear error message. However, the core risk assessment based on established genetic guidelines will still be provided.</p>
        </div>
        <div className="faq-item">
          <p className="faq-q">Can I add more medications?</p>
          <p className="faq-a">Yes, additional medications can be added by updating the system's genetic database. The interface allows you to enter any drug name manually for analysis.</p>
        </div>
      </section>

      <footer>
        &copy; 2026 PharmaGuard. Not medical advice. For research use only.
      </footer>
    </div>
  )
}
