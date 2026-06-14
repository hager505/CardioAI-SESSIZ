<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Best Model · ECG Multi-Label Classification</title>
    <!-- Google Fonts & simple reset -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #f5f7fb;
            font-family: 'Inter', sans-serif;
            color: #1a2634;
            line-height: 1.45;
            padding: 2rem 1.5rem;
        }

        .container {
            max-width: 1280px;
            margin: 0 auto;
        }

        /* header / hero */
        .hero {
            text-align: center;
            margin-bottom: 3rem;
        }
        .hero h1 {
            font-size: 2.4rem;
            font-weight: 700;
            background: linear-gradient(135deg, #1e3c72, #2a5298);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            letter-spacing: -0.3px;
            margin-bottom: 0.5rem;
        }
        .hero .tagline {
            font-size: 1.1rem;
            color: #2c3e66;
            border-bottom: 2px solid #e2e8f0;
            display: inline-block;
            padding-bottom: 0.4rem;
        }
        .badge-links {
            margin-top: 1.2rem;
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }
        .badge {
            background: white;
            border-radius: 40px;
            padding: 0.5rem 1.2rem;
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: 0 2px 6px rgba(0,0,0,0.04);
            transition: all 0.2s ease;
            text-decoration: none;
            color: #1e466e;
            border: 1px solid #dce5f0;
        }
        .badge:hover {
            background: #eef3fc;
            border-color: #8aa9c9;
            transform: translateY(-1px);
        }

        /* cards grid */
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
            gap: 1.8rem;
            margin-bottom: 2rem;
        }

        .card {
            background: white;
            border-radius: 28px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.03), 0 2px 6px rgba(0,0,0,0.05);
            overflow: hidden;
            transition: all 0.2s;
            border: 1px solid #edf2f7;
        }
        .card-header {
            padding: 1.2rem 1.5rem 0.5rem 1.5rem;
            font-weight: 700;
            font-size: 1.35rem;
            letter-spacing: -0.2px;
            background: #ffffff;
            border-bottom: 2px solid #eef2f9;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .card-header span {
            font-size: 1.6rem;
        }
        .card-content {
            padding: 1.2rem 1.5rem 1.6rem 1.5rem;
        }
        .stat-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            margin: 1rem 0 0.5rem;
        }
        .stat-item {
            background: #f8fafd;
            border-radius: 20px;
            padding: 0.5rem 1rem;
            flex: 1 1 auto;
            font-size: 0.85rem;
            font-weight: 500;
            color: #1f3b62;
        }
        .metric-highlight {
            background: #eef6ff;
            border-left: 4px solid #2a6eb0;
            padding: 0.7rem 1rem;
            border-radius: 16px;
            margin: 1rem 0 0.5rem;
            font-weight: 500;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }
        th, td {
            text-align: left;
            padding: 0.6rem 0.3rem;
            border-bottom: 1px solid #eef2f8;
        }
        th {
            font-weight: 600;
            color: #2c5a7a;
        }
        .chip {
            background: #eef2fa;
            border-radius: 30px;
            padding: 0.2rem 0.7rem;
            font-size: 0.75rem;
            font-weight: 500;
            display: inline-block;
            margin: 0.1rem 0.2rem;
        }
        hr {
            margin: 1rem 0;
            border: none;
            height: 1px;
            background: #e2edf7;
        }
        .footer {
            text-align: center;
            margin-top: 2.5rem;
            font-size: 0.8rem;
            color: #6c86a3;
            border-top: 1px solid #e0e9f2;
            padding-top: 2rem;
        }
        @media (max-width: 700px) {
            body { padding: 1rem; }
            .hero h1 { font-size: 1.8rem; }
        }
    </style>
</head>
<body>
<div class="container">
    <div class="hero">
        <h1>🫀 Best Model · ECG Multi‑Label Classification</h1>
        <div class="tagline">Hybrid deep learning for 12‑lead cardiac diagnosis</div>
        <div class="badge-links">
            <a href="https://www.kaggle.com/code/hagerabdelkaderr/best-model/edit" class="badge" target="_blank" rel="noopener">📓 Kaggle Notebook (best‑model)</a>
            <a href="https://www.kaggle.com/datasets/khyeh0719/ptb-xl-dataset" class="badge" target="_blank" rel="noopener">📊 PTB‑XL ECG Dataset</a>
        </div>
    </div>

    <div class="grid">
        <!-- DATASET CARD -->
        <div class="card">
            <div class="card-header"><span>📁</span> Dataset · PTB‑XL</div>
            <div class="card-content">
                <p><strong>21,837</strong> clinical 12‑lead ECGs · <strong>18,885</strong> patients<br>
                10‑second records · 100 Hz (downsampled) · multi‑label annotations by cardiologists (SCP‑ECG).</p>
                <div class="stat-grid">
                    <div class="stat-item">🧬 NORM: 9,528</div>
                    <div class="stat-item">❤️ MI: 5,486</div>
                    <div class="stat-item">⚡ STTC: 5,250</div>
                    <div class="stat-item">📡 CD: 4,907</div>
                    <div class="stat-item">🫀 HYP: 2,655</div>
                </div>
                <div class="metric-highlight">
                    ✅ Patient‑wise split (strat_fold)<br>
                    🔹 Folds 1‑8 → Train &nbsp;|&nbsp; Fold 9 → Val &nbsp;|&nbsp; Fold 10 → Test <br>
                    <span style="font-size:0.8rem;">🔒 zero patient overlap → no data leakage</span>
                </div>
            </div>
        </div>

        <!-- PREPROCESSING CARD -->
        <div class="card">
            <div class="card-header"><span>⚙️</span> Preprocessing pipeline</div>
            <div class="card-content">
                <ul style="margin-left: 1.2rem; color: #2c3e4e;">
                    <li>📋 Tabular data (age, sex, height, weight, pacemaker) → missing filled with 0</li>
                    <li>📏 Demographic features scaled with <code>StandardScaler</code> (fit on train only)</li>
                    <li>🧲 ECG signal: <strong>lead‑wise StandardScaler</strong> → zero mean, unit variance</li>
                    <li>✂️ No leakage: scaler fitted on train → applied to val/test</li>
                    <li>🔁 Augmentation (training only): random time window + Gaussian noise (σ=0.05)</li>
                </ul>
                <div class="metric-highlight" style="margin-top: 0.8rem;">
                    ✅ Result: clean, normalized signals & fair evaluation
                </div>
            </div>
        </div>

        <!-- MODEL ARCHITECTURE CARD -->
        <div class="card">
            <div class="card-header"><span>🧠</span> Hybrid architecture</div>
            <div class="card-content">
                <p><strong>Dual‑input design</strong></p>
                <ul style="margin-left: 1.2rem;">
                    <li>📊 <strong>Demographics branch</strong> (7 features) → Dense layers + dropout</li>
                    <li>📈 <strong>ECG branch</strong> (1000×12) → Conv1D + BatchNorm + GlobalAvgPool</li>
                    <li>➕ Concatenation → fusion of clinical & signal features</li>
                    <li>🎯 Final dense layers → 5 sigmoid outputs (multi‑label probability)</li>
                </ul>
                <div class="chip">Total parameters ~154K</div>
                <div class="chip">Binary cross‑entropy + class weights</div>
                <div class="chip">Dropout = 0.5 · EarlyStopping · ReduceLROnPlateau</div>
            </div>
        </div>
    </div>

    <!-- PERFORMANCE SECTION (wide card) -->
    <div class="card" style="margin-bottom: 1.8rem;">
        <div class="card-header"><span>📈</span> Results & performance</div>
        <div class="card-content">
            <div style="display: flex; flex-wrap: wrap; gap: 1.8rem; justify-content: space-between;">
                <div style="flex: 1; min-width: 200px;">
                    <h3 style="font-weight: 600; font-size: 1.1rem;">✅ Validation</h3>
                    <p><strong>Binary accuracy:</strong> 89.31%<br>
                    <strong>ROC‑AUC (macro):</strong> 0.90<br>
                    <strong>F1 macro:</strong> 0.688 – 0.70</p>
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <h3 style="font-weight: 600; font-size: 1.1rem;">🧪 Test (unseen patients)</h3>
                    <p><strong>Binary accuracy:</strong> ≈88–89%<br>
                    <strong>Overfitting gap:</strong> &lt;4% (train/val)<br>
                    <strong>Precision / Recall:</strong> balanced per class</p>
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <h3 style="font-weight: 600; font-size: 1.1rem;">📌 Per‑class accuracy (test)</h3>
                    <table style="margin-top: 0;">
                        <tr><th>CD</th><td>89.2%</td></tr>
                        <tr><th>HYP</th><td>88.1%</td></tr>
                        <tr><th>MI</th><td>87.4%</td></tr>
                        <tr><th>NORM</th><td>87.0%</td></tr>
                        <tr><th>STTC</th><td>87.0%</td></tr>
                    </table>
                </div>
            </div>
            <hr>
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center;">
                <div><span class="chip">💡 ROC‑AUC > 0.90</span> <span class="chip">📉 Low overfitting</span> <span class="chip">🧪 Ready for real‑world testing</span></div>
                <div style="font-weight: 500;">🔮 Model shows strong generalisation on fold 10 (completely unseen patients).</div>
            </div>
        </div>
    </div>

    <!-- CONCLUSION / DEPLOYMENT -->
    <div class="card">
        <div class="card-header"><span>🚀</span> Conclusion & deployment readiness</div>
        <div class="card-content">
            <p>The proposed <strong>hybrid CNN + dense model</strong> accurately classifies 5 major cardiac conditions from standard 12‑lead ECG and demographic data.  
            Thanks to <strong>patient‑wise stratification</strong> (strat_fold), lead‑wise normalization, and careful split design, the model generalises to new patients with <strong>≈89% binary accuracy</strong> and an AUC of <strong>0.90</strong>.  
            Lightweight architecture (~154K parameters) + fast inference → suitable for clinical decision support systems.</p>
            <div class="metric-highlight" style="margin-top: 0.6rem;">
                ✅ final model file: <code>model02.keras</code> · ready for backend integration  
                ✅ accepts two inputs: (ECG: 1000×12) + (demographics: 7 features)  
                ✅ outputs: 5 independent probabilities [CD, HYP, MI, NORM, STTC]
            </div>
        </div>
    </div>

    <!-- FOOTER with citation-ish note -->
    <div class="footer">
        <span>🧠 PTB‑XL citation: Wagner et al., Scientific Data 2020 · 10‑fold patient‑wise split</span><br>
        <span>📌 Project code & dataset publicly available on Kaggle · built with TensorFlow / Keras</span>
    </div>
</div>
</body>
</html>
photo_2026-06-13_07-12-21 image
