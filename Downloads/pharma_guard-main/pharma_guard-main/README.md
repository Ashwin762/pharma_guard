/////////     DEPLOYED LINK     ///////////


----->https://pharma-guard-mu.vercel.app/

PharmaGuard is a precision-medicine web application that analyzes patient genomic data (VCF format) to predict drug response risks and generate clinically interpretable pharmacogenomic recommendations.

It combines rule-based CPIC pharmacogenomics guidelines with AI-generated clinical explanations to help researchers and clinicians make safer, data-driven prescribing decisions.


///////////////////  ARCHITECTURE DIGRAM   //////////////////////

                     ┌──────────────────────────────┐
                     │          User Browser        │
                     │  Upload VCF + Enter Drug     │
                     └───────────────┬──────────────┘
                                     │
                                     ▼
                     ┌──────────────────────────────┐
                     │         Frontend UI          │
                     │  (HTML / React / Tailwind)   │
                     └───────────────┬──────────────┘
                                     │ REST API
                                     ▼
                     ┌──────────────────────────────┐
                     │        FastAPI Backend       │
                     └───────────────┬──────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
        ┌──────────────┐      ┌──────────────┐        ┌──────────────┐
        │  VCF Parser  │      │  Phenotype   │        │  CPIC Rule   │
        │    Engine    │      │    Engine    │        │    Engine    │
        └──────────────┘      └──────────────┘        └──────────────┘    
                    
                                    │
                                    ▼
                     
                     ┌──────────────────────────────┐
                     │  LLM Explanation Generator   │
                     └───────────────┬──────────────┘
                                     ▼
                     ┌──────────────────────────────┐
                     │   JSON Schema Formatter      │
                     └───────────────┬──────────────┘
                                     ▼
                     ┌──────────────────────────────┐
                     │     Structured JSON Output   │
                     └──────────────────────────────┘
                
