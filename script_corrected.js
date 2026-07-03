  // ══════════════════════════════════════════════════════════════════════════════
  //  EXPERIMENT CONFIGURATION — only edit these sections
  // ══════════════════════════════════════════════════════════════════════════════

  // ── 1. Fixed Shape ─────────────────────────────────────────────────────────
  // true  → same shape every trial, randomly rotated each trial.
  //         Start and end indices stay fixed and rotate with the shape.
  // false → a different noise-based random shape is picked each trial.
  const FIXED_SHAPE = true;

  // Middle-line points of the fixed shape (x, y in canvas px; theta = outward normal angle).
  const FIXED_MIDDLE_POINTS = [
    {x:395.091,y:270.000,theta:0.000},{x:378.397,y:293.040,theta:0.209},
    {x:369.752,y:314.412,theta:0.419},{x:357.767,y:333.766,theta:0.628},
    {x:367.450,y:378.229,theta:0.838},{x:324.543,y:364.472,theta:1.047},
    {x:313.689,y:404.461,theta:1.257},{x:281.808,y:382.348,theta:1.466},
    {x:258.742,y:377.109,theta:1.676},{x:230.016,y:393.057,theta:1.885},
    {x:200.614,y:390.179,theta:2.094},{x:190.547,y:358.242,theta:2.304},
    {x:154.773,y:353.717,theta:2.513},{x:169.555,y:314.721,theta:2.723},
    {x:134.792,y:298.739,theta:2.932},{x:157.273,y:270.000,theta:3.142},
    {x:155.101,y:245.577,theta:3.351},{x:149.477,y:216.340,theta:3.560},
    {x:154.720,y:186.244,theta:3.770},{x:187.689,y:178.585,theta:3.979},
    {x:215.982,y:176.437,theta:4.189},{x:225.221,y:132.185,theta:4.398},
    {x:257.355,y:149.687,theta:4.608},{x:284.837,y:128.835,theta:4.817},
    {x:314.638,y:132.618,theta:5.027},{x:323.966,y:176.529,theta:5.236},
    {x:367.462,y:161.758,theta:5.445},{x:372.795,y:195.315,theta:5.655},
    {x:371.717,y:224.713,theta:5.864},{x:402.549,y:241.826,theta:6.074}
  ];

  // Start and end as [x, y] on the unrotated shape above.
  // The nearest point in FIXED_MIDDLE_POINTS is used automatically.
  const FIXED_START_XY  = [195.09, 186.81];
  const FIXED_TARGET_XY = [165.51, 223.48];

  // ── 2. Block Sequence ──────────────────────────────────────────────────────
  const USE_BLOCKS        = true;
  const BLOCK_COUNTDOWN_S = 60;    // seconds shown between blocks

  // Each block: { numTrials, rotation (° added to cursor input), lag (ms) }
  const BLOCKS_A = [
    { numTrials: 20, rotation:  0, lag:   0 },
    { numTrials: 40, rotation: 30, lag:   0 },
    { numTrials: 40, rotation: 30, lag: 250 },
    { numTrials: 30, rotation:  0, lag:   0 },
  ];

  const BLOCKS_B = [
    { numTrials: 20, rotation:  0, lag:   0 },
    { numTrials: 40, rotation:  0, lag: 250 },
    { numTrials: 40, rotation: 30, lag: 250 },
    { numTrials: 30, rotation:  0, lag:   0 },
  ];

  let BLOCKS = BLOCKS_A;

  // ═══════════════════════════════════════════════════════════════════════════════

  window.onload = function() {
    // ===================== Global State =====================
    let user = {};
    let inputDevice = "mouse"; // mouse | xbox | extreme3dpro | wacom
    let trial = 1, totalTrials = 5, score = 100, defaultScore = 100, width = 40;
    let noiseMag = 0.15, pathLength = 1000, nSegments = 30;
    let deductError = 1, deductTime = 0.01;
    let rotationAngle = 0; // degrees
    let lagMs = 0;
    let experimentOver = false;
    let deductionType = "time"; // time | movement
    let deductTimer = null;
    const shapeRadius = 200;
    const noiseFreq = 5;
    let numShapes = 20;
    let canvas, ctx;
    let drawnPath = [];
    let reachedTarget = false;
    let amoebaShapes = [];
    let currentShapeIdx = null;
    let midPoints = [], outlineOuter = [], outlineInner = [], outlineMiddle = [];
    let startIdx, targetIdx, wallLine = null;
    let penPos = {x: 0, y: 0};
    let drawing = false;
    let mouseIsDown = false;
    let lastMouse = {x:0, y:0};
    let errorPoints = [];
    let showErrorCircle = false;
    const center = {x:270, y:270};
    let mergedData = [];
    let allShapeData = [];
    let trialStartTime = null;
    let trialStarted = false;
    let movementBuffer = [];

    let blockTrialScores = [];

    // Tablet/Wacom state
    let tabletActive = false;

    // Angular section tracking for perpendicular penalties
    const ANGULAR_SECTION_DEGREES = 1;  // Size of each angular section in degrees
    const ANGULAR_SECTION_RADIANS = ANGULAR_SECTION_DEGREES * Math.PI / 180;
    let lastAngularSection = null;  // Track which section we were in last

    // Block-sequence state
    let currentBlockIdx  = 0;
    let trialWithinBlock = 0;
    let currentSequence  = 'A';

    // Fixed-shape: index of start and target in FIXED_MIDDLE_POINTS
    let fixedStartIdx  = FIXED_SHAPE ? findNearestIdx(FIXED_MIDDLE_POINTS, FIXED_START_XY[0],  FIXED_START_XY[1])  : 0;
    let fixedTargetIdx = FIXED_SHAPE ? findNearestIdx(FIXED_MIDDLE_POINTS, FIXED_TARGET_XY[0], FIXED_TARGET_XY[1]) : 0;

    // Gamepad params
    const GP = {
      index: 0,
      deadzone: 0.12,
      sensitivity: 1.5,
      invertX: false,
      invertY: false,
      activeButton: 0
    };
    let gpPrevActive = false;

    // ===================== DOM =====================
    const frontPage = document.getElementById('frontPage');
    const experimentPage = document.getElementById('experimentPage');
    const form = document.getElementById('spatForm');
    const trialProgress = document.getElementById('trialProgress');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const trialMsg = document.getElementById('trialMsg');
    const previewCanvas = document.getElementById('previewCanvas');
    const previewCtx = previewCanvas.getContext('2d');
    const finalPlotDiv = document.getElementById('finalPlot');
    const blockResultsDiv = document.getElementById('blockResults');
    const summaryBox = document.getElementById('summaryBox');
    const restartBtn = document.getElementById('restartBtn');
    const resumeOverlay = document.getElementById('resumeOverlay');
    const resumeBtn = document.getElementById('resumeBtn');
    const sequenceSelectionDiv = document.getElementById('sequenceSelection');
    const sequenceSelect = document.getElementById('sequenceSelect');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    // ===================== DTW-RMSE PENALTY =====================
    // Formula mirrors the Python score_dtw_rmse:
    //   dtw_n  = dtw_mean_dist normalised within [DTW_LO, DTW_HI]
    //   time_n = time normalised within [TIME_LO, TIME_HI]
    //   rmse   = sqrt((dtw_n² + time_n²) / 2)
    //   inv    = 1 / (1 + rmse)
    //   score  = clamp((inv - INV_MIN) / (INV_MAX - INV_MIN) * 100, 1, 99)
    //
    // Anchors derived from pilot data (9 participants, mean ± margin)
    // INV_MIN = 0.500  (below observed floor 0.514)
    // INV_MAX = 1.000  (above observed ceiling 0.971 → score always < 100)

    const DTW_TARGET_LENGTH = 1000;

    // Per-participant observed ranges for normalising dtw and time before RMSE.
    // Set to the approximate population ranges seen in pilot data.
    const DTW_NORM_LO  = 0.0;    // DTW mean dist lower bound (perfect trial)
    const DTW_NORM_HI  = 15.0;   // DTW mean dist upper bound (very poor trial)
    const TIME_NORM_LO = 1.0;    // seconds (fastest plausible trial)
    const TIME_NORM_HI = 50.0;   // seconds (slowest plausible trial)

    const INV_MIN = 0.500;
    const INV_MAX = 1.000;

    function computeDTWDistance(seq1, seq2) {
      const n = seq1.length, m = seq2.length;
      if (n === 0 || m === 0) return 0;
      let prevRow = new Float32Array(m);
      let currRow = new Float32Array(m);
      prevRow[0] = Math.abs(seq1[0] - seq2[0]);
      for (let j = 1; j < m; j++)
        prevRow[j] = prevRow[j - 1] + Math.abs(seq1[0] - seq2[j]);
      for (let i = 1; i < n; i++) {
        currRow[0] = prevRow[0] + Math.abs(seq1[i] - seq2[0]);
        for (let j = 1; j < m; j++) {
          const cost = Math.abs(seq1[i] - seq2[j]);
          currRow[j] = cost + Math.min(prevRow[j], currRow[j - 1], prevRow[j - 1]);
        }
        [prevRow, currRow] = [currRow, prevRow];
      }
      return prevRow[m - 1];
    }

    function resample1DArray(arr, targetLength) {
      if (arr.length === 0) return new Float32Array(targetLength);
      if (arr.length === 1) { let r = new Float32Array(targetLength); r.fill(arr[0]); return r; }
      const res = new Float32Array(targetLength);
      for (let i = 0; i < targetLength; i++) {
        const val = i * (arr.length - 1) / (targetLength - 1);
        const idx = Math.floor(val), frac = val - idx;
        res[i] = idx >= arr.length - 1
          ? arr[arr.length - 1]
          : arr[idx] * (1 - frac) + arr[idx + 1] * frac;
      }
      return res;
    }
    const HARMONIC_NORM_LO = 0.01;   // global min of raw_h across all participants
    const HARMONIC_NORM_HI = 0.25;   // global max of raw_h across all participants

    function calculateDTWRMSEPenalty() {
      if (drawnPath.length < 5) return defaultScore * 0.5;

      // ── 1. Mean deviation from shape outline ──────────────────────────────
      const n = outlineMiddle.length;
      const idealPathPoints = [];
      let curr = startIdx;
      let safetyCount = 0;
      while (curr !== targetIdx && safetyCount < n) {
        idealPathPoints.push(outlineMiddle[curr]);
        curr = (curr + 1) % n;
        safetyCount++;
      }
      idealPathPoints.push(outlineMiddle[targetIdx]);

      // ── 2. Flatten to 1-D radial distance and compute DTW ──
      const flatten = pts =>
        pts.map(pt => Math.hypot(pt.x - center.x, pt.y - center.y) - shapeRadius);

      const idealResampled  = resample1DArray(flatten(idealPathPoints), DTW_TARGET_LENGTH);
      const cursorResampled = resample1DArray(flatten(drawnPath),       DTW_TARGET_LENGTH);

      const meanDev = computeDTWDistance(idealResampled, cursorResampled) / DTW_TARGET_LENGTH;

      // ── 2. Trial time ──────────────────────────────────────────────────────
      const timeSec = Math.max(getTrialTime(), 0.001);

      // ── 3. Raw harmonic value: 1 / sqrt(mean_dev * time) ──────────────────
      const rawH = 1.0 / Math.sqrt(Math.max(meanDev, 1e-6) ** 1.5 * timeSec);

      // ── 4. Normalise to [0, 100] using pilot anchors ──────────────────────
      const span = HARMONIC_NORM_HI - HARMONIC_NORM_LO;
      const score = Math.min(99, Math.max(1,
        (rawH - HARMONIC_NORM_LO) / span * 100
      ));

      const penalty = defaultScore * (1 - score / 100);

      console.log(
        `Harmonic → mean_dev: ${meanDev.toFixed(4)}, ` +
        `time: ${timeSec.toFixed(2)}s, ` +
        `raw_h: ${rawH.toFixed(6)}, ` +
        `score: ${score.toFixed(1)}, penalty: ${penalty.toFixed(2)}`
      );

      return penalty;
    }

    // ===================== Global Fullscreen Management =====================
    function launchFullscreen() {
      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', launchFullscreen);
    }

    // ── Sequence Selection ─────────────────────────────────────────────────────

    function applySelection(value) {
      if (value === 'A') {
        BLOCKS = BLOCKS_A;
        currentSequence = 'A';
      } else if (value === 'B') {
        BLOCKS = BLOCKS_B;
        currentSequence = 'B';
      } else {
        // Single block: value is like "A1", "A2", "B1", "B2"...
        const seqLetter = value[0];          // 'A' or 'B'
        const blockIdx  = parseInt(value[1]) - 1;
        const source    = seqLetter === 'A' ? BLOCKS_A : BLOCKS_B;
        BLOCKS = [source[blockIdx]];
        currentSequence = seqLetter;
      }
      console.log(`Selection: ${value} → ${BLOCKS.length} block(s)`);
    }

    // Replace the two sequenceBtnA/B listeners with this single one:
    if (sequenceSelect) {
      sequenceSelect.addEventListener('change', function() {
        applySelection(this.value);
      });
      applySelection(sequenceSelect.value); // apply default on load
    }

    // ===================== Utilities =====================
    function findNearestIdx(points, tx, ty) {
      let best = 0, bestDist = Infinity;
      points.forEach((pt, i) => {
        const d = Math.hypot(pt.x - tx, pt.y - ty);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    }

    function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
      const d1x = bx - ax, d1y = by - ay;
      const d2x = dx - cx, d2y = dy - cy;
      const cross = d1x * d2y - d1y * d2x;
      if (Math.abs(cross) < 1e-10) return false;
      const tx = cx - ax, ty = cy - ay;
      const t = (tx * d2y - ty * d2x) / cross;
      const u = (tx * d1y - ty * d1x) / cross;
      return t > 0 && t < 1 && u >= 0 && u <= 1;
    }

    function resampleOutline(points, numSamples) {
      let dists = [0];
      for (let i=1; i<points.length; ++i)
        dists[i] = dists[i-1] + Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
      dists.push(dists[points.length-1] + Math.hypot(points[0].x - points[points.length-1].x, points[0].y - points[points.length-1].y));
      let totalLen = dists[dists.length-1];
      let resampled = [];
      for (let k=0; k<numSamples; ++k) {
        let targetDist = totalLen * k / numSamples;
        let i=0; while(i<dists.length-1 && dists[i+1] < targetDist) ++i;
        let t = (targetDist - dists[i])/(dists[i+1]-dists[i]);
        let idx1 = i % points.length, idx2 = (i+1)%points.length;
        resampled.push({
          x: points[idx1].x * (1-t) + points[idx2].x * t,
          y: points[idx1].y * (1-t) + points[idx2].y * t
        });
      }
      return resampled;
    }

    function drawSmoothClosedCurve(ctx, points) {
      if(points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length; i++) {
        let p0 = points[i];
        let p1 = points[(i + 1) % points.length];
        let mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        ctx.quadraticCurveTo(p0.x, p0.y, mid.x, mid.y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    function drawSmoothOpenCurve(ctx, points) {
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i], p1 = points[i + 1];
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        ctx.quadraticCurveTo(p0.x, p0.y, mid.x, mid.y);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    }

    // ===================== Trial Timing =====================
    function startTrialTimer() { trialStartTime = performance.now(); }
    function getTrialTime() {
      if (!trialStarted || !trialStartTime) return 0;
      return (performance.now() - trialStartTime) / 1000;
    }

    function rotateDelta(dx, dy) {
      let theta = rotationAngle * Math.PI / 180;
      let cosT = Math.cos(theta), sinT = Math.sin(theta);
      return {
        dx: cosT * dx - sinT * dy,
        dy: sinT * dx + cosT * dy
      };
    }

    function buildWallLine() {
      const midx=(midPoints[startIdx].x+midPoints[targetIdx].x)/2;
      const midy=(midPoints[startIdx].y+midPoints[targetIdx].y)/2;
      const dx=midPoints[targetIdx].x-midPoints[startIdx].x;
      const dy=midPoints[targetIdx].y-midPoints[startIdx].y;
      const len=Math.hypot(dx,dy), px=-dy/len, py=dx/len;
      const extra=80;
      wallLine={
        x1:midx+px*(width/2+extra/.5), y1:midy+py*(width/2+extra/.5),
        x2:midx-px*(width/2+extra), y2:midy-py*(width/2+extra)
      };
    }

    function applyFixedShapeForTrial() {
      const angle = Math.random()*2*Math.PI;
      const cos=Math.cos(angle), sin=Math.sin(angle);
      midPoints=[]; outlineOuter=[]; outlineInner=[]; outlineMiddle=[];

      for (const pt of FIXED_MIDDLE_POINTS) {
        const dx=pt.x-center.x, dy=pt.y-center.y;
        const rx=center.x + dx*cos - dy*sin;
        const ry=center.y + dx*sin + dy*cos;
        const rTheta=pt.theta+angle;

        midPoints.push({x:rx, y:ry, theta:rTheta});
        outlineMiddle.push({x:rx, y:ry});

        const nx=Math.cos(rTheta), ny=Math.sin(rTheta);
        outlineOuter.push({x:rx+nx*width/2, y:ry+ny*width/2});
        outlineInner.push({x:rx-nx*width/2, y:ry-ny*width/2});
      }

      startIdx  = fixedStartIdx;
      targetIdx = fixedTargetIdx;
      buildWallLine();

      penPos    = {x:outlineMiddle[startIdx].x, y:outlineMiddle[startIdx].y};
      drawnPath = [{x:penPos.x, y:penPos.y}];
    }

    function showTrialScore(trialScore) {
      const overlay = document.getElementById('trialEndOverlay');
      const scoreValue = document.getElementById('trialScoreValue');
      scoreValue.textContent = trialScore.toFixed(2);
      overlay.classList.add('show');
    }

    function hideTrialScore() {
      const overlay = document.getElementById('trialEndOverlay');
      overlay.classList.remove('show');
    }

    function applyBlockSettings(block){
      rotationAngle = block.rotation;
      lagMs         = block.lag;
    }

    function showBlockCountdown(seconds, onDone) {
      const overlay = document.getElementById('countdownOverlay');
      const titleEl = document.getElementById('countdownTitle');
      const countEl = document.getElementById('countdownText');
      titleEl.textContent = `End of Block ${currentBlockIdx + 1}`;
      overlay.style.display = 'flex';
      let remaining = seconds;
      countEl.textContent = remaining;
      const iv = setInterval(() => {
        remaining--;
        countEl.textContent = remaining;
        if (remaining <= 0) {
          clearInterval(iv);
          overlay.style.display = 'none';
          onDone();
        }
      }, 1000);
    }

    function reachedTargetPoint(x, y) {
      let target = {
        x: outlineMiddle[targetIdx].x,
        y: outlineMiddle[targetIdx].y
      };
      return Math.hypot(x - target.x, y - target.y) < 13;
    }

    function drawStar(ctx, x, y, spikes, outerRadius, innerRadius, color) {
      let rot = Math.PI / 2 * 3;
      let step = Math.PI / spikes;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y - outerRadius);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(x + Math.cos(rot) * outerRadius, y + Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(x + Math.cos(rot) * innerRadius, y + Math.sin(rot) * innerRadius);
        rot += step;
      }
      ctx.lineTo(x, y - outerRadius);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }

    function drawAmoeba() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.strokeStyle = "#fff2e0";
      ctx.lineWidth = 3;
      drawSmoothClosedCurve(ctx, outlineOuter);
      drawSmoothClosedCurve(ctx, outlineInner);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "#952905";
      ctx.lineWidth = 3;
      let curve = [outlineMiddle[startIdx]];
      let i = startIdx;
      let safetyCount = 0;
      while (i != targetIdx && safetyCount < outlineMiddle.length) {
        i = (i + 1) % outlineMiddle.length;
        curve.push(outlineMiddle[i]);
        safetyCount++;
      }
      drawSmoothOpenCurve(ctx, curve);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = "#952905";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(wallLine.x1, wallLine.y1);
      ctx.lineTo(wallLine.x2, wallLine.y2);
      ctx.stroke();
      ctx.restore();

      let start = { x: outlineMiddle[startIdx].x, y: outlineMiddle[startIdx].y };
      ctx.save();
      ctx.fillStyle = "#15616d";
      ctx.beginPath();
      ctx.arc(start.x, start.y, 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      let target = { x: outlineMiddle[targetIdx].x, y: outlineMiddle[targetIdx].y };
      drawStar(ctx, target.x, target.y, 5, 12, 5, "#ff7d00");

      if (drawnPath.length > 1) {
        ctx.save();
        ctx.strokeStyle = "#15616d";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(drawnPath[0].x, drawnPath[0].y);
        for (let pt of drawnPath) { ctx.lineTo(pt.x, pt.y); }
        ctx.stroke();
        ctx.restore();
      }

      if (drawing || drawnPath.length) {
        ctx.save();
        ctx.fillStyle = "#4299a6";
        ctx.beginPath();
        ctx.arc(penPos.x, penPos.y, 7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }
    }

    function startDeductTimer() {
      if (deductionType !== 'time') return;
      if (deductTimer) clearInterval(deductTimer);
      let lastTick = performance.now();
      deductTimer = setInterval(()=>{
        if (!trialStarted) return;
        let now = performance.now();
        let dt = (now - lastTick) / 1000; lastTick = now;
        score = Math.max(0, score - deductTime * dt * 20);
        scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
      }, 20);
    }

    function stopDeductTimer(){ if (deductTimer) clearInterval(deductTimer); deductTimer = null; }

    function beginDrawingIfNeeded(sourceTag) {
      if (!trialStarted) { startTrialTimer(); trialStarted = true; }
      if (!drawing) {
        drawing = true;
        showErrorCircle = false;
        errorPoints = [];
        mergedData.push({
          trial: trial, block: currentBlockIdx + 1, time: getTrialTime(),
          mouseX: null, mouseY: null, movementX: 0, movementY: 0,
          penX: penPos.x, penY: penPos.y, allowed: 1, mouseUp: 0, error: 0,
          score: score, source: sourceTag || 'unknown', rotation: rotationAngle,
          lag: lagMs, sequence: currentSequence, section: lastAngularSection
        });
      }
      startDeductTimer();
    }

    function endDrawingIfNeeded(sourceTag) {
      if (drawing) {
        drawing = false;
        stopDeductTimer();
        showErrorCircle = false;
        mergedData.push({
          trial: trial, block: currentBlockIdx + 1, time: getTrialTime(),
          mouseX: null, mouseY: null, movementX: 0, movementY: 0,
          penX: penPos.x, penY: penPos.y, allowed: 1, mouseUp: 1, error: 0,
          score: score, source: sourceTag || 'unknown', rotation: rotationAngle,
          lag: lagMs, sequence: currentSequence, section: lastAngularSection
        });
      }
    }

    function resample1DArray(arr, targetLength) {
        if (arr.length === 0) return new Float32Array(targetLength);
        if (arr.length === 1) {
            let res = new Float32Array(targetLength);
            res.fill(arr[0]);
            return res;
        }
        let res = new Float32Array(targetLength);
        for (let i = 0; i < targetLength; i++) {
            let val = i * (arr.length - 1) / (targetLength - 1);
            let idx = Math.floor(val);
            let frac = val - idx;
            if (idx >= arr.length - 1) {
                res[i] = arr[arr.length - 1];
            } else {
                res[i] = arr[idx] * (1 - frac) + arr[idx + 1] * frac;
            }
        }
        return res;
    }

    function computeDTWDistance(seq1, seq2) {
        const n = seq1.length; const m = seq2.length;
        if (n === 0 || m === 0) return 0;
        let prevRow = new Float32Array(m);
        let currRow = new Float32Array(m);
        prevRow[0] = Math.abs(seq1[0] - seq2[0]);
        for (let j = 1; j < m; j++) {
            prevRow[j] = prevRow[j - 1] + Math.abs(seq1[0] - seq2[j]);
        }
        for (let i = 1; i < n; i++) {
            currRow[0] = prevRow[0] + Math.abs(seq1[i] - seq2[0]);
            for (let j = 1; j < m; j++) {
                const cost = Math.abs(seq1[i] - seq2[j]);
                currRow[j] = cost + Math.min(prevRow[j], currRow[j - 1], prevRow[j - 1]);
            }
            let temp = prevRow; prevRow = currRow; currRow = temp;
        }
        return prevRow[m - 1];
    }

    function processOneDelta(dx, dy, now, sourceTag) {
      const rot = rotateDelta(dx, dy);
      dx = rot.dx; dy = rot.dy;

      const oldx = penPos.x, oldy = penPos.y;
      penPos.x += dx;
      penPos.y += dy;

      if (wallLine && segmentsIntersect(oldx, oldy, penPos.x, penPos.y, 
                                        wallLine.x1, wallLine.y1, 
                                        wallLine.x2, wallLine.y2)) {
        penPos.x = oldx; penPos.y = oldy;
        score = Math.max(0, score - deductError * 10);
        scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
        drawAmoeba();
        return;
      }

      scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
      drawnPath.push({ x: penPos.x, y: penPos.y });
      drawAmoeba();

      mergedData.push({
          trial: trial, block: currentBlockIdx + 1, time: getTrialTime(),
          mouseX: null, mouseY: null, movementX: dx, movementY: dy,
          penX: penPos.x, penY: penPos.y, allowed: 1, mouseUp: 0, error: 0,
          score: score, source: sourceTag || 'unknown', rotation: rotationAngle,
          lag: lagMs, sequence: currentSequence, section: lastAngularSection
      });

      if (deductionType === 'time') {
          score = Math.max(0, score - deductTime * 0.016);
          scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
      }

      if (!reachedTarget && reachedTargetPoint(penPos.x, penPos.y)) {
        reachedTarget = true;
        endDrawingIfNeeded(sourceTag);

        const penalty = calculateDTWRMSEPenalty();
        score = Math.max(0, score - penalty);
        scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;

        blockTrialScores.push(score);

        showTrialScore(score);
        if (blockTrialScores.length > 0) {
          displayBlockResultsGraph();
        }
        setTimeout(() => { 
            hideTrialScore();
            advanceTrialOrEnd(); 
        }, 2000);
      }
    }

    // ===================== Input Listeners =====================
    function attachCanvasListenersMouse() {
      let old = canvas;
      let newCanvas = canvas.cloneNode(true);
      old.parentNode.replaceChild(newCanvas, old);
      canvas = newCanvas;
      ctx = canvas.getContext('2d');

      canvas.addEventListener('mousedown', (e)=>{
        if (!trialStarted) { startTrialTimer(); trialStarted = true; }
        mouseIsDown = true;
        beginDrawingIfNeeded('mouse');
        if (drawnPath.length === 0) {
          penPos = { x: outlineMiddle[startIdx].x, y: outlineMiddle[startIdx].y };
          drawnPath = [{x: penPos.x, y: penPos.y}];
        }
        lastMouse = {x: e.clientX, y: e.clientY};
        drawAmoeba();
      });

      canvas.addEventListener('mousemove', (e)=>{
        if (document.pointerLockElement !== canvas) return;
        if(!trialStarted || !mouseIsDown || !drawing) return;
        let now = performance.now();
        if (lagMs > 0) {
          movementBuffer.push({dx: e.movementX, dy: e.movementY, time: now});
          while (movementBuffer.length && movementBuffer[0].time < now - lagMs - 2000)
            movementBuffer.shift();
          while (movementBuffer.length && movementBuffer[0].time <= now - lagMs) {
            let mv = movementBuffer.shift();
            processOneDelta(mv.dx, mv.dy, now, 'mouse');
          }
        } else {
          processOneDelta(e.movementX, e.movementY, now, 'mouse');
        }
      });

      canvas.addEventListener('mouseup', ()=>{ mouseIsDown = false; drawAmoeba(); });
      canvas.addEventListener('mouseleave', ()=>{ mouseIsDown = false; drawAmoeba(); });
      canvas.addEventListener('mouseenter', (e)=>{ if(e.buttons & 1) mouseIsDown = true; });
    }

    function attachCanvasListenersTablet() {
      let old = canvas;
      let newCanvas = canvas.cloneNode(true);
      old.parentNode.replaceChild(newCanvas, old);
      canvas = newCanvas;
      ctx = canvas.getContext('2d');

      let lastPenPos = null;
      let activePenterId = null;

      canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        if (!trialStarted) { startTrialTimer(); trialStarted = true; }

        activePenterId = e.pointerId;

        try {
          canvas.setPointerCapture(e.pointerId);
        } catch(err) {
          console.warn('setPointerCapture failed:', err);
          // On continue quand même — le fallback lastPenPos prendra le relais
        }

        tabletActive = true;
        beginDrawingIfNeeded('tablet');

        if (drawnPath.length === 0) {
          penPos = { x: outlineMiddle[startIdx].x, y: outlineMiddle[startIdx].y };
          drawnPath = [{ x: penPos.x, y: penPos.y }];
        }
        lastPenPos = { x: e.clientX, y: e.clientY };  // toujours initialisé ici
        drawAmoeba();
      });

    canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    if (!trialStarted || !tabletActive || !drawing) return;
    if (e.pointerId !== activePenterId) return;

    let now = performance.now();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

    for (const ce of events) {
      if (!lastPenPos) {
        lastPenPos = { x: ce.clientX, y: ce.clientY };
        // PAS de return/continue ici — on initialise et on continue
      }
      const dx = ce.clientX - lastPenPos.x;
      const dy = ce.clientY - lastPenPos.y;
      lastPenPos = { x: ce.clientX, y: ce.clientY };

      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) continue; // ignorer micro-bruit

      if (lagMs > 0) {
        movementBuffer.push({ dx, dy, time: now });
        while (movementBuffer.length && movementBuffer[0].time < now - lagMs - 2000)
          movementBuffer.shift();
        while (movementBuffer.length && movementBuffer[0].time <= now - lagMs) {
          let mv = movementBuffer.shift();
          processOneDelta(mv.dx, mv.dy, now, 'pen');
        }
      } else {
        processOneDelta(dx, dy, now, 'pen');
      }
    }

    if (reachedTarget) {
      tabletActive = false;
      activePenterId = null;
      lastPenPos = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
  });

      canvas.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        tabletActive = false;
        activePenterId = null;
        lastPenPos = null;
        try { canvas.releasePointerCapture(e.pointerId); } catch(err) {}
        endDrawingIfNeeded('tablet');
        drawAmoeba();
      });

      // *** KEY FIX: don't kill tabletActive on pointerleave ***
      // Pointer capture means pointermove still fires even outside the canvas,
      // so pointerleave firing mid-stroke was incorrectly stopping drawing.
    }

    function gamepadLoop(){
      if (experimentOver) return;
      const dev = inputDevice;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = pads && pads[GP.index] ? pads[GP.index] : null;

      if (gp) {
        let ax = gp.axes[0] || 0; let ay = gp.axes[1] || 0;
        if (GP.invertX) ax = -ax; if (GP.invertY) ay = -ay;
        const mag = Math.hypot(ax, ay);
        if (mag < GP.deadzone) { ax = 0; ay = 0; }
        const dx = ax * GP.sensitivity; const dy = ay * GP.sensitivity;
        const active = !!(gp.buttons && gp.buttons[GP.activeButton] && gp.buttons[GP.activeButton].pressed);

        if (active && !gpPrevActive) {
          if (!trialStarted) { startTrialTimer(); trialStarted = true; }
          beginDrawingIfNeeded(dev);
          if (drawnPath.length === 0) {
            penPos = { x: outlineMiddle[startIdx].x, y: outlineMiddle[startIdx].y };
            drawnPath = [{x: penPos.x, y: penPos.y}];
          }
        }
        if (!active && gpPrevActive) endDrawingIfNeeded(dev);

        if (active && drawing) {
          let now = performance.now();
          if (lagMs > 0) {
            movementBuffer.push({dx, dy, time: now});
            while (movementBuffer.length && movementBuffer[0].time < now - lagMs - 2000)
              movementBuffer.shift();
            while (movementBuffer.length && movementBuffer[0].time <= now - lagMs) {
              let mv = movementBuffer.shift();
              processOneDelta(mv.dx, mv.dy, now, dev);
            }
          } else {
            processOneDelta(dx, dy, now, dev);
          }
        }
        gpPrevActive = active;
      }
      drawAmoeba();
      requestAnimationFrame(gamepadLoop);
    }

    // ===================== Trial Flow =====================
    function nextTrial(){
      if (trial > 1 && outlineOuter && outlineInner) {
        allShapeData.push({
            trial: trial - 1,
            inner: resampleOutline(outlineInner, 360),
            outer: resampleOutline(outlineOuter, 360),
            middle: resampleOutline(outlineMiddle, 360)
        });
      }
      console.log(BLOCKS[currentBlockIdx].numTrials)
      trialMsg.textContent = '';
      trialProgress.textContent = USE_BLOCKS && BLOCKS.length
      ? `Block ${currentBlockIdx + 1}/${BLOCKS.length} — Trial ${trialWithinBlock} of ${BLOCKS[currentBlockIdx].numTrials}`
      : `Trial ${trial} of ${totalTrials}`;
      
      score = defaultScore;
      scoreDisplay.textContent = `Score: ${score}`;
      drawnPath = []; errorPoints = []; reachedTarget = false; movementBuffer = []; gpPrevActive = false;
      
      if(FIXED_SHAPE){
        applyFixedShapeForTrial();
      } else {
        generateTrialGeometry();
      }
      drawAmoeba();
      trialStarted = false;
    }

    function fitSSM(scores) {
      const m = scores.length - 1; if (m < 2) return null;
      let sumXX = 0, sumX = 0, sumXY = 0, sumY = 0;
      for (let i = 0; i < m; i++) {
        const xi = scores[i], xi1 = scores[i + 1];
        sumXX += xi * xi; sumX += xi; sumXY += xi * xi1; sumY += xi1;
      }
      const denom = m * sumXX - sumX * sumX;
      if (Math.abs(denom) < 1e-10) return null;
      const A = (m * sumXY - sumX * sumY) / denom;
      const B = (sumY - A * sumX) / m;
      return { A, B };
    }

    function isSSMStable(history, windowSize, threshold) {
      if (history.length < windowSize) return false;
      const recent = history.slice(-windowSize);
      const rangeA = Math.max(...recent.map(h => h.A)) - Math.min(...recent.map(h => h.A));
      const rangeB = Math.max(...recent.map(h => h.B)) - Math.min(...recent.map(h => h.B));
      return rangeA < threshold && rangeB < threshold;
    }

    function advanceTrialOrEnd() {
      if (USE_BLOCKS && BLOCKS.length > 0) {
        trialWithinBlock++;
        const block = BLOCKS[currentBlockIdx];
        const blockDone = trialWithinBlock >= block.numTrials;

        if (blockDone) {
          if (currentBlockIdx < BLOCKS.length - 1) {
            showBlockCountdown(BLOCK_COUNTDOWN_S, () => {
              currentBlockIdx++;
              trialWithinBlock = 0;
              blockTrialScores = [];
              applyBlockSettings(BLOCKS[currentBlockIdx]);
              if (trial < totalTrials) { trial++; nextTrial(); } else endExperiment();
            });
          } else {
            endExperiment();
          }
        } else {
          if (trial < totalTrials) { trial++; nextTrial(); } else endExperiment();
        }
      } else {
        if (trial < totalTrials) { trial++; nextTrial(); } else endExperiment();
      }
    }

    function endExperiment(){
      experimentOver = true;
      document.body.style.cursor = 'default';
      if(outlineOuter && outlineInner) {
        allShapeData.push({ 
          trial: trial, 
          inner: resampleOutline(outlineInner, 360), 
          outer: resampleOutline(outlineOuter, 360), 
          middle: resampleOutline(outlineMiddle, 360)
        });
      }
      let finalScores = [];
      let penMoveRows = mergedData.filter(d => d.mouseUp==1 || d.error==1 || d.allowed==1);
      let lastScoreByTrial = {};
      for (let row of penMoveRows) lastScoreByTrial[row.trial] = row.score;
      let maxTrial = Math.max(...penMoveRows.map(d=>d.trial));
      for(let t=1; t<=maxTrial; ++t) finalScores.push(lastScoreByTrial[t]||0);
      
      Plotly.newPlot('finalPlot', [{
          x: finalScores.map((_,i)=>i+1), y: finalScores, type: 'scatter', mode:'lines+markers', name:'Score',
          marker:{size:10, color:'#1976d2'}, line:{color:'#1976d2'}
        }], { margin:{t:30}, xaxis:{title:'Trial'}, yaxis:{title:'Score', rangemode:'tozero'}, title:'Final Score per Trial' },
        {displayModeBar:false}
      );

      let header = ['Trial','Block','Time','MouseX','MouseY','MovementX','MovementY','PenX','PenY','Allowed','MouseUp','Error','Score','Source','Angle','Lag','Sequence','AngularSection'];
      let penMouseRows = [header];
      for(let row of mergedData){
        penMouseRows.push([row.trial, row.block, row.time, row.mouseX, row.mouseY, row.movementX, row.movementY, row.penX, row.penY, row.allowed, row.mouseUp, row.error, row.score, row.source || '', row.rotation, row.lag, row.sequence, row.section]);
      }
      let wb = XLSX.utils.book_new();
      let ws = XLSX.utils.aoa_to_sheet(penMouseRows);
      XLSX.utils.book_append_sheet(wb, ws, "PenAndMouseData");

      let shapeRows = [['Trial','InnerX','InnerY','OuterX','OuterY','MiddleX','MiddleY' ]];
      for(let sh of allShapeData){
        for(let i=0; i<360; i++) {
          shapeRows.push([sh.trial, sh.inner[i].x, sh.inner[i].y, sh.outer[i].x, sh.outer[i].y, sh.middle[i].x, sh.middle[i].y]);
        }
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(shapeRows), "ShapeData");

      let filename = `SPAT_${user.name || 'anon'}_sequence_${currentSequence}_${new Date().toISOString().replace(/[-T:.Z]/g,'')}.xlsx`;
      if (document.pointerLockElement) {
        document.exitPointerLock();
        setTimeout(()=>{
          XLSX.writeFile(wb, filename);
          document.getElementById('experimentEndOverlay').style.display = "block";
          restartBtn.style.display = "block";
        }, 200);
      } else {
        XLSX.writeFile(wb, filename);
        document.getElementById('experimentEndOverlay').style.display = "block";
        restartBtn.style.display = "block";
      }
    }

    // ===================== Form Submit =====================
    form.onsubmit = function(e){
      e.preventDefault();
      user.name = document.getElementById('name').value || '';
      inputDevice = document.getElementById('inputDevice').value;
      user.rotation = parseFloat(document.getElementById('rotation').value) || 0;
      user.lag = parseInt(document.getElementById('lag').value) || 0;
      user.trialNum = parseInt(document.getElementById('trialNum').value) || 5;
      user.width = parseInt(document.getElementById('width').value) || 40;
      user.score = parseInt(document.getElementById('score').value) || 100;
      user.deductError = parseFloat(document.getElementById('deductError').value) || 1;
      user.deductTime = parseFloat(document.getElementById('deductTime').value) || 0.01;
      user.noiseMag = parseFloat(document.getElementById('noiseMag').value) || 0.15;
      user.pathLength = parseInt(document.getElementById('pathLength').value) || 1000;
      user.nSegments = parseInt(document.getElementById('nSegments').value) || 30;

      // Remove cursor globally across entire document body
      document.body.style.cursor = 'none';

      experimentOver = false;
      deductionType = document.querySelector('input[name="deductType"]:checked').value;
      width = user.width; score = user.score; defaultScore = user.score; noiseMag = user.noiseMag;
      pathLength = user.pathLength; nSegments = user.nSegments; deductError = user.deductError; deductTime = user.deductTime;

      currentBlockIdx=0; trialWithinBlock=0;
      if (USE_BLOCKS && BLOCKS.length > 0) {
        totalTrials = BLOCKS.reduce((s, b) => s + b.numTrials, 0);
        applyBlockSettings(BLOCKS[0]);
      } else {
        totalTrials = user.trialNum; rotationAngle = user.rotation; lagMs = user.lag;
      }

      frontPage.style.display = 'none';
      experimentPage.style.display = 'block';
      trial = 1;
      scoreDisplay.style.display = 'none';
      scoreDisplay.textContent = 'Score: ' + score;
      finalPlotDiv.innerHTML = ''; blockResultsDiv.innerHTML = ''; summaryBox.innerHTML = '';
      restartBtn.style.display = "none"; resumeOverlay.style.display = "none";

      canvas = document.getElementById('spatCanvas');
      ctx = canvas.getContext('2d');
      mergedData = []; allShapeData = [];
      
      nextTrial();

      if (inputDevice === 'mouse') {
        attachCanvasListenersMouse();
        setTimeout(()=>{
          let c = document.getElementById('spatCanvas');
          if (document.pointerLockElement !== c) c.requestPointerLock();
        }, 10);
      } else if (inputDevice === 'wacom') {
        trialMsg.textContent = 'Connect your tablet/Wacom pen and start drawing';
        attachCanvasListenersTablet();
      } else {
        trialMsg.textContent = 'Connect your gamepad and hold B0 to draw';
        requestAnimationFrame(gamepadLoop);
      }

      // Force draw amoeba AFTER listeners are established and canvas is finalized
      drawAmoeba();
    };

    restartBtn.onclick = function() {
      experimentOver = false;
      document.getElementById('fullscreenBtn').addEventListener('click', launchFullscreen);
      experimentPage.style.display = 'none';
      frontPage.style.display = 'block';
      summaryBox.innerHTML = ""; finalPlotDiv.innerHTML = ""; blockResultsDiv.innerHTML = "";
      restartBtn.style.display = "none"; resumeOverlay.style.display = "none";
      document.getElementById('experimentEndOverlay').style.display = "none";
      document.body.style.cursor = 'default';
      currentBlockIdx=0; trialWithinBlock=0;
      mergedData = []; allShapeData = []; blockTrialScores = [];
    };

    document.addEventListener('pointerlockchange', function() {
      if (!canvas) return;
      drawAmoeba();
      if (document.pointerLockElement !== canvas) {
        if (inputDevice==='mouse' && !experimentOver) {
          drawing = false; mouseIsDown = false;
          resumeOverlay.style.display = "flex"; trialMsg.textContent = '';
        } else {
          resumeOverlay.style.display = "none";
        }
      } else {
        resumeOverlay.style.display = "none";
      }
    });

    resumeBtn.onclick = function() {
      if (canvas && inputDevice==='mouse') canvas.requestPointerLock();
    };

    function displayBlockResultsGraph() {
      const graphDiv = document.getElementById('graph');
      if (!graphDiv) return;
      graphDiv.innerHTML = '';
      
      let maxTrialsInBlock = BLOCKS[currentBlockIdx].numTrials;
      let allTrialNums = Array.from({length: maxTrialsInBlock}, (_, i) => i + 1);
      let completedTrialNums = Array.from({length: blockTrialScores.length}, (_, i) => i + 1);
      
      let data = [{
          x: completedTrialNums, y: blockTrialScores, type: 'scatter', mode: 'lines+markers', name: 'Trial Score',
          line: { color: '#78290f', width: 2 }, marker: { size: 8, color: '#78290f' }
      }];

      let layout = {
          title: { text: `Block ${currentBlockIdx + 1} - Trial Scores`, font: { family: 'Arial, sans-serif', size: 18, color: '#15616d' } },
          xaxis: {
              title: { text: 'Trial Number', font: { family: 'Arial, sans-serif', size: 14, color: '#fae5c6' } },
              tickvals: allTrialNums, ticktext: allTrialNums.map(String), zeroline: false,
              range: [0.5, maxTrialsInBlock + 0.5], gridcolor: '#fae5c6', gridwidth: 1, gridpattern: 'dot'
          },
          yaxis: {
              title: { text: 'Score', font: { family: 'Arial, sans-serif', size: 14, color: '#15616d' } },
              zeroline: false, range: [0, defaultScore], gridcolor: '#fff2e0', gridwidth: 1, gridpattern: 'dot'
          },
          hovermode: 'closest', width: 700, height: 400, margin: { l: 60, r: 40, t: 60, b: 60 },
          plot_bgcolor: '#fff2e0', paper_bgcolor: '#fff2e0', font: { family: 'Arial, sans-serif', size: 12, color: '#15616d' }
      };

      if (typeof Plotly !== 'undefined') {
          Plotly.newPlot(graphDiv, data, layout, { displayModeBar: false });
      }
    }

    window.addEventListener('keydown', function(e) {
      if (e.key.toLowerCase() === 'n') {
        if (experimentPage.style.display === 'block' && !experimentOver) {
          if (!trialStarted) { advanceTrialOrEnd(); return; }
          if (deductTimer) clearInterval(deductTimer);
          drawing = false; mouseIsDown = false; tabletActive = false;
          endDrawingIfNeeded('forced_skip');      
          scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
          scoreDisplay.style.display = 'none';
          trialMsg.textContent = 'Press N again for next trial';
          
          if (blockTrialScores.length > 0) displayBlockResultsGraph();
          
          let skipNextAdvance = true;
          window.addEventListener('keydown', function advance(e2) {
            if (e2.key.toLowerCase() === 'n' && skipNextAdvance) {
              skipNextAdvance = false;
              window.removeEventListener('keydown', advance);
              advanceTrialOrEnd();
            }
          });
        }
      }
    });
  }; // End window.onload