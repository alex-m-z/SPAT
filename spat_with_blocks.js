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
// true  → experiment runs as the sequence defined in BLOCKS[].
//         The "Trial number" form field is ignored.
// false → "Trial number" form field controls the total number of trials.
const USE_BLOCKS        = true;
const BLOCK_COUNTDOWN_S = 5;    // seconds shown between blocks

// Each block: { numTrials, rotation (° added to cursor input), lag (ms) }
const BLOCKS_A = [
  { numTrials: 30, rotation: 0, lag: 0 },
  { numTrials: 40, rotation: 30, lag: 0 },
  { numTrials: 40, rotation: 30, lag: 500 },
  { numTrials: 30, rotation: 0, lag: 0 },
];

const BLOCKS_B = [
  { numTrials: 30, rotation:  0, lag:   0 },
  { numTrials: 40, rotation: 0, lag: 500 },
  { numTrials: 40, rotation:  30, lag: 500 },
  { numTrials: 30, rotation:  0, lag: 0 },
];

let BLOCKS = BLOCKS_A;

// ══════════════════════════════════════════════════════════════════════════════

window.onload = function() {
  // ===================== Global State =====================
  let user = {};
  let inputDevice = "mouse"; // mouse | xbox | extreme3dpro
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

  // Angular section tracking for perpendicular penalties
  const ANGULAR_SECTION_DEGREES = 1;  // Size of each angular section in degrees
  const ANGULAR_SECTION_RADIANS = ANGULAR_SECTION_DEGREES * Math.PI / 180;
  let lastAngularSection = null;  // Track which section we were in last

  // Block-sequence state
  let currentBlockIdx  = 0;
  let trialWithinBlock = 0;
  let currentSequence  = 'A';

  // Fixed-shape: index of start and target in FIXED_MIDDLE_POINTS
  // (findNearestIdx is a function declaration, so it is hoisted and safe to call here)
  let fixedStartIdx  = FIXED_SHAPE ? findNearestIdx(FIXED_MIDDLE_POINTS, FIXED_START_XY[0],  FIXED_START_XY[1])  : 0;
  let fixedTargetIdx = FIXED_SHAPE ? findNearestIdx(FIXED_MIDDLE_POINTS, FIXED_TARGET_XY[0], FIXED_TARGET_XY[1]) : 0;

  // Gamepad params (especially for Extreme 3D Pro)
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
  const summaryBox = document.getElementById('summaryBox');
  const restartBtn = document.getElementById('restartBtn');
  const resumeOverlay = document.getElementById('resumeOverlay');
  const resumeBtn = document.getElementById('resumeBtn');
  const sequenceSelectionDiv = document.getElementById('sequenceSelection');
  const sequenceBtnA = document.getElementById('sequenceBtnA');
  const sequenceBtnB = document.getElementById('sequenceBtnB');

  // ── Sequence Selection ─────────────────────────────────────────────────────
  if (sequenceBtnA) {
    sequenceBtnA.addEventListener('change', function() {
      if (this.checked) {
        BLOCKS = BLOCKS_A;
        currentSequence = BLOCKS;
        console.log('Switched to Sequence A');
        console.log('currentSequence', currentSequence)

      }
    });
  }
 
  if (sequenceBtnB) {
    sequenceBtnB.addEventListener('change', function() {
      if (this.checked) {
        BLOCKS = BLOCKS_B;
        currentSequence = BLOCKS;
        console.log('Switched to Sequence B');
        console.log('currentSequence', currentSequence)

      }
    });
  }

  // ===================== Utilities =====================
  function seededRandom(seed) {
    var t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // Returns the index of the point in `points` whose (x,y) is nearest to (tx, ty).
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
    if (Math.abs(cross) < 1e-10) return false; // parallel
    const tx = cx - ax, ty = cy - ay;
    const t = (tx * d2y - ty * d2x) / cross;
    const u = (tx * d1y - ty * d1x) / cross;
    return t > 0 && t < 1 && u >= 0 && u <= 1;
  }

  function generateAmoebaShape(seed, widthVal, noiseMagVal, noiseFreqVal, pathLengthVal, nSegmentsVal, centerX, centerY) {
    let mid = [], totalLen = 0, prev = null;
    for(let i=0; i<nSegmentsVal; i++){
      let theta = 2*Math.PI*i/nSegmentsVal;
      let r = shapeRadius + noiseMagVal * Math.sin(noiseFreqVal*theta + 10*seededRandom(seed+i));
      let x = centerX + r*Math.cos(theta);
      let y = centerY + r*Math.sin(theta);
      if(prev) totalLen += Math.hypot(x-prev.x, y-prev.y);
      prev = {x,y};
      mid.push({x,y,theta});
    }
    let scale = pathLengthVal/totalLen;
    for(let pt of mid){
      pt.x = centerX + (pt.x-centerX)*scale;
      pt.y = centerY + (pt.y-centerY)*scale;
    }
    let out = [], inn = [], middle = [];
    for(let pt of mid){
      let nx = Math.cos(pt.theta), ny = Math.sin(pt.theta);
      out.push({ x: pt.x + nx*widthVal/2, y: pt.y + ny*widthVal/2 });
      middle.push({ x: pt.x, y: pt.y })
      inn.push({ x: pt.x - nx*widthVal/2, y: pt.y - ny*widthVal/2 });
    }
    return {midPoints: mid, outlineOuter: out, outlineInner: inn, outlineMiddle: middle};
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

  function drawAmoebaPreview(){
    let widthP = parseInt(document.getElementById('width').value) || 40;
    let noiseMagP = parseFloat(document.getElementById('noiseMag').value) || 0.15;
    let pathLengthP = parseInt(document.getElementById('pathLength').value) || 1000;
    let nSegmentsP = parseInt(document.getElementById('nSegments').value) || 30;
    let actualNoiseMagP = noiseMagP * shapeRadius;
    let shape = generateAmoebaShape(999, widthP, actualNoiseMagP, noiseFreq, pathLengthP, nSegmentsP, 170, 170);
    previewCtx.clearRect(0,0,340,340);
    previewCtx.save();
    previewCtx.strokeStyle = "#fff2e0";
    previewCtx.lineWidth = 2.2;
    drawSmoothClosedCurve(previewCtx, resampleOutline(shape.outlineOuter, 360));
    previewCtx.strokeStyle = "#fff2e0";
    previewCtx.lineWidth = 2.2;
    drawSmoothClosedCurve(previewCtx, resampleOutline(shape.outlineInner, 360));
    previewCtx.strokeStyle = "#ff8686";
    previewCtx.lineWidth = 2.2;
    drawSmoothClosedCurve(previewCtx, resampleOutline(shape.outlineMiddle, 360));
    previewCtx.restore();
  }
  ['width','noiseMag','pathLength','nSegments'].forEach(id=>{
    document.getElementById(id).addEventListener('input', drawAmoebaPreview);
  });
  drawAmoebaPreview();

  // ===================== Trial Timing =====================
  function startTrialTimer() { trialStartTime = performance.now(); }
  function getTrialTime() {
    if (!trialStarted || !trialStartTime) return 0;
    return (performance.now() - trialStartTime) / 1000;
  }

  function rotateDelta(dx, dy) {
    let theta = rotationAngle * Math.PI / 180;
    let cosT = Math.cos(theta), sinT = Math.sin(theta);
    let dxr = cosT * dx - sinT * dy;
    let dyr = sinT * dx + cosT * dy;
    return {dx: dxr, dy: dyr};
  }

  function generateAllAmoebas(){
    if (FIXED_SHAPE) return;          // fixed shape needs no pool
    amoebaShapes = [];
    for(let i=0; i<numShapes; i++){
      amoebaShapes.push(
        generateAmoebaShape(
          i+100, width,
          noiseMag * shapeRadius,
          noiseFreq, pathLength,
          nSegments, center.x, center.y
        )
      );
    }
  }

  // ── Fixed shape: rotate FIXED_MIDDLE_POINTS by a random angle ─────────────
  // Builds the wall line from the current midPoints, startIdx, targetIdx.
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

  // Rotates FIXED_MIDDLE_POINTS by a fresh random angle, rebuilds all outlines.
  function applyFixedShapeForTrial() {
    const angle = Math.random()*2*Math.PI;
    const cos=Math.cos(angle), sin=Math.sin(angle);

    midPoints=[]; outlineOuter=[]; outlineInner=[]; outlineMiddle=[];

    for (const pt of FIXED_MIDDLE_POINTS) {
      // Rotate point around canvas centre
      const dx=pt.x-center.x, dy=pt.y-center.y;
      const rx=center.x + dx*cos - dy*sin;
      const ry=center.y + dx*sin + dy*cos;
      const rTheta=pt.theta+angle;           // rotated outward normal

      midPoints.push   ({x:rx, y:ry, theta:rTheta});
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

  function pickRandomAmoebaShape(){
    let idx = Math.floor(Math.random()*numShapes);
    currentShapeIdx = idx;
    midPoints = amoebaShapes[idx].midPoints;
    outlineOuter = amoebaShapes[idx].outlineOuter;
    outlineInner = amoebaShapes[idx].outlineInner;
    outlineMiddle = amoebaShapes[idx].outlineMiddle;
  }

  // ===================== Block Sequence Management =====================
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

  // ===================== Penalty Calculation =====================
  function getPerpendicularDistance(x, y) {
    let min = Infinity;
    const n = outlineMiddle.length;
    for (let i = 0; i < n; i++) {
      const x1 = outlineMiddle[i].x,          y1 = outlineMiddle[i].y;
      const x2 = outlineMiddle[(i+1)%n].x,    y2 = outlineMiddle[(i+1)%n].y;
      const dx = x2 - x1, dy = y2 - y1;
      const lenSq = dx*dx + dy*dy;
      const t = lenSq > 0 ? Math.max(0, Math.min(1, ((x-x1)*dx + (y-y1)*dy) / lenSq)) : 0;
      const dist = Math.hypot(x - (x1 + t*dx), y - (y1 + t*dy));
      if (dist < min) min = dist;
    }
    return min;
  }

  // Gets the angular section (0, 1, 2, ...) for a given position relative to center
  function getAngularSection(x, y) {
    const angle = Math.atan2(y - center.y, x - center.x);
    // Convert angle to 0-360 range (in radians: 0 to 2π)
    const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
    // Calculate which section (0.1° increments)
    const section = Math.floor(normalizedAngle / ANGULAR_SECTION_RADIANS);
    return section;
  }

  // Get all angular sections crossed when moving from (x1,y1) to (x2,y2)
  function getSectionsCrossed(x1, y1, x2, y2) {
    const section1 = getAngularSection(x1, y1);
    const section2 = getAngularSection(x2, y2);
    
    if (section1 === section2) return []; // No crossing
    
    const sections = [];
    let current = section1;
    const maxSections = Math.floor(360 / ANGULAR_SECTION_DEGREES);
    
    if (section2 > section1) {
      // Straightforward case: sections increase
      for (let s = section1 + 1; s <= section2; s++) {
        sections.push(s);
      }
    } else {
     for (let s = section2 + 1; s <= section1; s++) {
        sections.push(s);
      }
    }
    
    return sections;
  }

  // Interpolate position for a given angular section boundary
  function interpolatePositionForSection(x1, y1, x2, y2, targetSection) {
    // Find the angle of the section boundary
    const targetAngle = targetSection * ANGULAR_SECTION_RADIANS;
    
    // Current angles
    const angle1 = Math.atan2(y1 - center.y, x1 - center.x);
    const angle2 = Math.atan2(y2 - center.y, x2 - center.x);
    
    // Normalize angles
    let norm1 = angle1 < 0 ? angle1 + 2 * Math.PI : angle1;
    let norm2 = angle2 < 0 ? angle2 + 2 * Math.PI : angle2;
    
    // Handle wrap-around
    if (norm2 < norm1 && norm2 < Math.PI && norm1 > Math.PI) {
      norm2 += 2 * Math.PI;
    }
    
    // Linear interpolation based on angle
    if (Math.abs(norm2 - norm1) < 1e-6) {
      // Angles too similar, use midpoint
      return {x: (x1 + x2) / 2, y: (y1 + y2) / 2};
    }
    
    const t = (targetAngle - norm1) / (norm2 - norm1);
    const clampedT = Math.max(0, Math.min(1, t));
    
    return {
      x: x1 + (x2 - x1) * clampedT,
      y: y1 + (y2 - y1) * clampedT
    };
  }

  // Checks if we crossed into new angular sections and applies penalty for each
  function checkAngularSectionCrossing(oldX, oldY, newX, newY) {
    const currentSection = getAngularSection(newX, newY);
    
    if (lastAngularSection === null) {
      // First time, just initialize
      lastAngularSection = currentSection;
      return;
    }
    console.log('last angular section', lastAngularSection);
    
    // Get all sections crossed during this movement
    const crossedSections = getSectionsCrossed(oldX, oldY, newX, newY);
    
    if (crossedSections.length > 0) {
      console.log(crossedSections);
      // For each section crossed, interpolate position and apply penalty
      for (const section of crossedSections) {
        const interpPos = interpolatePositionForSection(oldX, oldY, newX, newY, section);
        const distance = getPerpendicularDistance(interpPos.x, interpPos.y);
        console.log('distance', distance);
        const penalty = 0.001 * distance * distance;
        console.log('penalty', penalty);
        score = Math.max(0, score - penalty);
        scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
        errorPoints.push({ x: interpPos.x, y: interpPos.y });
        showErrorCircle = true;
      }
      
      // Update to new section
      lastAngularSection = currentSection;
    }
  }

  // ===================== Target and Drawing =====================
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.cursor = (inputDevice === 'mouse') ? 'none' : 'default';

    ctx.save();
    ctx.strokeStyle = "#fff2e0";
    ctx.lineWidth = 3;
    drawSmoothClosedCurve(ctx, outlineOuter);
    ctx.strokeStyle = "#fff2e0";
    ctx.lineWidth = 3;
    drawSmoothClosedCurve(ctx, outlineInner);
    ctx.restore();

    // Draw middle line visible arc from startIdx forwards to targetIdx
    ctx.save();
    ctx.strokeStyle = "#952905";
    ctx.lineWidth = 3;
    let curve = [outlineMiddle[startIdx]];
    let i = startIdx;
    while (i != targetIdx) {
      i = (i + 1) % outlineMiddle.length;
      curve.push(outlineMiddle[i]);
    }
    drawSmoothOpenCurve(ctx, curve);
    ctx.restore();

    // Draw wall (thick brown/orange line)
    ctx.save();
    ctx.strokeStyle = "#952905";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(wallLine.x1, wallLine.y1);
    ctx.lineTo(wallLine.x2, wallLine.y2);
    ctx.stroke();
    ctx.restore();

    // Draw start point (teal circle)
    let start = {
      x: outlineMiddle[startIdx].x,
      y: outlineMiddle[startIdx].y
    };
    ctx.save();
    ctx.fillStyle = "#15616d";
    ctx.beginPath();
    ctx.arc(start.x, start.y, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Draw target point (orange star)
    let target = {
      x: outlineMiddle[targetIdx].x,
      y: outlineMiddle[targetIdx].y
    };
    drawStar(ctx, target.x, target.y, 5, 12, 5, "#ff7d00");

    // Draw path (teal)
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

    // Draw pen cursor (teal)
    if (drawing || drawnPath.length) {
      ctx.save();
      ctx.fillStyle = "#4299a6";
      ctx.beginPath();
      ctx.arc(penPos.x, penPos.y, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
  }

  function generateTrialGeometry(){
    const minSeparation = 60;
    let dist = 0, idx = startIdx = Math.floor(Math.random()*nSegments);
    do {
      let next = (idx - 1 + nSegments) % nSegments;
      dist += Math.hypot(midPoints[next].x - midPoints[idx].x, midPoints[next].y - midPoints[idx].y);
      idx = next;
    } while (dist < minSeparation && idx !== startIdx);
    targetIdx = idx;

    let midx = (midPoints[startIdx].x + midPoints[targetIdx].x)/2;
    let midy = (midPoints[startIdx].y + midPoints[targetIdx].y)/2;
    let dx = midPoints[targetIdx].x - midPoints[startIdx].x;
    let dy = midPoints[targetIdx].y - midPoints[startIdx].y;
    let len = Math.hypot(dx, dy);
    let px = -dy/len, py = dx/len;
    const wallExtra = 15;
    wallLine = {
      x1: midx + px*(width/2 + wallExtra),
      y1: midy + py*(width/2 + wallExtra),
      x2: midx - px*(width/2 + wallExtra),
      y2: midy - py*(width/2 + wallExtra)
    };

    penPos = {
      x: outlineMiddle[startIdx].x,
      y: outlineMiddle[startIdx].y
    };
    drawnPath = [{x: penPos.x, y: penPos.y}];
  }

  // ===================== Input Handling =====================
  function startDeductTimer() {
    if (deductionType !== 'time') return;
    if (deductTimer) clearInterval(deductTimer);
    let lastTick = performance.now();
    deductTimer = setInterval(()=>{
      if (!drawing) return;
      let now = performance.now();
      let dt = (now - lastTick) / 1000; lastTick = now;
      score -= deductTime * dt * 20;
      score = Math.max(0, score) ;
      scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
      if (score <= 0 && !reachedTarget) { stopDrawingAndAdvance(); }
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
        trial: trial,
        block: currentBlockIdx + 1,
        time: getTrialTime(),
        mouseX: null,
        mouseY: null,
        movementX: 0,
        movementY: 0,
        penX: penPos.x,
        penY: penPos.y,
        allowed: 1,
        mouseUp: 0,
        error: 0,
        score: score,
        source: sourceTag || 'unknown',
        rotation: rotationAngle,
        lag: lagMs,
        sequence: currentSequence,
        section: lastAngularSection
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
        trial: trial,
        block: currentBlockIdx + 1,
        time: getTrialTime(),
        mouseX: null,
        mouseY: null,
        movementX: 0,
        movementY: 0,
        penX: penPos.x,
        penY: penPos.y,
        allowed: 1,
        mouseUp: 1,
        error: 0,
        score: score,
        source: sourceTag || 'unknown',
        rotation: rotationAngle,
        lag: lagMs,
        sequence: currentSequence,
        section: lastAngularSection
      });
    }
  }

  function processOneDelta(dx, dy, now, sourceTag) {
    const rot = rotateDelta(dx, dy);
    dx = rot.dx; dy = rot.dy;

    if (wallLine && segmentsIntersect(
        penPos.x, penPos.y,
        penPos.x + dx, penPos.y + dy,
        wallLine.x1, wallLine.y1,
        wallLine.x2, wallLine.y2
    )) return;

    const oldx = penPos.x, oldy = penPos.y;
    penPos.x += dx;
    penPos.y += dy;

    // Check for angular section crossings (including intermediate sections for fast movements)
    checkAngularSectionCrossing(oldx, oldy, penPos.x, penPos.y);

    mergedData.push({
      trial: trial,
      block: currentBlockIdx + 1,
      time: getTrialTime(),
      mouseX: null,
      mouseY: null,
      movementX: dx,
      movementY: dy,
      penX: penPos.x,
      penY: penPos.y,
      allowed: 1,
      mouseUp: 0,
      error: 0,
      score: score,
      source: sourceTag || 'unknown',
      rotation: rotationAngle,
      lag: lagMs,
      sequence: currentSequence,
      section: lastAngularSection
    });

    drawnPath.push({x: penPos.x, y: penPos.y});

    drawAmoeba();

    if (!reachedTarget && reachedTargetPoint(penPos.x, penPos.y)) {
      reachedTarget = true;
      endDrawingIfNeeded(sourceTag);
      drawAmoeba();
      setTimeout(() => { advanceTrialOrEnd(); }, 700);
      return;
    }

    if (score <= 0 && !reachedTarget) {
      endDrawingIfNeeded(sourceTag);
      movementBuffer = [];
      setTimeout(() => { advanceTrialOrEnd(); }, 700);
    }
  }

  function stopDrawingAndAdvance(){
    endDrawingIfNeeded('timer');
    setTimeout(()=>{ advanceTrialOrEnd(); }, 700);
  }

  // =========== Mouse Listeners ===========
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
        penPos = {
          x: outlineMiddle[startIdx].x,
          y: outlineMiddle[startIdx].y
        };
        drawnPath = [{x: penPos.x, y: penPos.y}];
      }
      lastMouse = {x: e.clientX, y: e.clientY};
      drawAmoeba();
    });

    canvas.addEventListener('mousemove', (e)=>{
      if (document.pointerLockElement !== canvas) return;
      if(!trialStarted) return;
      if (!mouseIsDown) return;
      if (!drawing) return;
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

    canvas.addEventListener('mouseup', ()=>{
      mouseIsDown = false;
      endDrawingIfNeeded('mouse');
      drawAmoeba();
    });
    canvas.addEventListener('mouseleave', ()=>{
      mouseIsDown = false;
      endDrawingIfNeeded('mouse');
      drawAmoeba();
    });
    canvas.addEventListener('mouseenter', (e)=>{ if(e.buttons & 1) mouseIsDown = true; });
  }

  // =========== Gamepad Loop ===========
  function gamepadLoop(){
    if (experimentOver) return;
    const dev = inputDevice;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && pads[GP.index] ? pads[GP.index] : null;

    if (gp) {
      let ax = gp.axes[0] || 0;
      let ay = gp.axes[1] || 0;
      if (GP.invertX) ax = -ax;
      if (GP.invertY) ay = -ay;
      const mag = Math.hypot(ax, ay);
      if (mag < GP.deadzone) { ax = 0; ay = 0; }
      const dx = ax * GP.sensitivity;
      const dy = ay * GP.sensitivity;

      const active = !!(gp.buttons && gp.buttons[GP.activeButton] && gp.buttons[GP.activeButton].pressed);

      if (active && !gpPrevActive) {
        if (!trialStarted) { startTrialTimer(); trialStarted = true; }
        beginDrawingIfNeeded(dev);
        if (drawnPath.length === 0) {
          penPos = {
            x: outlineMiddle[startIdx].x,
            y: outlineMiddle[startIdx].y
          };
          drawnPath = [{x: penPos.x, y: penPos.y}];
        }
      }
      if (!active && gpPrevActive) {
        endDrawingIfNeeded(dev);
      }

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
    if(trial > 1 && outlineOuter && outlineInner) {
      let inner360 = resampleOutline(outlineInner, 360);
      let outer360 = resampleOutline(outlineOuter, 360);
      let middle360= resampleOutline(outlineMiddle, 360);
      allShapeData.push({ trial: trial - 1, inner: inner360, outer: outer360, middle: middle360 });
    }
    trialMsg.textContent = '';
    trialProgress.textContent = USE_BLOCKS&&BLOCKS.length
      ? `Block ${currentBlockIdx+1}/${BLOCKS.length} — Trial ${trial} of ${totalTrials}`
      : `Trial ${trial} of ${totalTrials}`;
    score = defaultScore;
    scoreDisplay.textContent = `Score: ${score}`;
    drawnPath = [];
    errorPoints = [];
    reachedTarget = false;
    movementBuffer = [];
    gpPrevActive = false;
    lastAngularSection = null;  // Reset angular section tracking for new trial
    
    if(FIXED_SHAPE){
      applyFixedShapeForTrial();   // random rotation, fixed indices
    } else {
      pickRandomAmoebaShape();
      generateTrialGeometry();
    }
    
    drawAmoeba();
    trialStarted = false;
  }

  function advanceTrialOrEnd(){
    if(USE_BLOCKS&&BLOCKS.length>0){
      trialWithinBlock++;
      if(trialWithinBlock>=BLOCKS[currentBlockIdx].numTrials){
        // Block finished
        if(currentBlockIdx<BLOCKS.length-1){
          showBlockCountdown(BLOCK_COUNTDOWN_S,()=>{
            currentBlockIdx++; trialWithinBlock=0;
            applyBlockSettings(BLOCKS[currentBlockIdx]);
            if(trial<totalTrials){trial++;nextTrial();}else endExperiment();
          });
        } else { endExperiment(); }
      } else {
        if(trial<totalTrials){trial++;nextTrial();}else endExperiment();
      }
    } else {
      if(trial<totalTrials){trial++;nextTrial();}else endExperiment();
    }
  }

  function endExperiment(){
    experimentOver = true;
    if(outlineOuter && outlineInner) {
      let inner360 = resampleOutline(outlineInner, 360);
      let outer360 = resampleOutline(outlineOuter, 360);
      let middle360= resampleOutline(outlineMiddle, 360);
      allShapeData.push({ trial: trial, inner: inner360, outer: outer360, middle: middle360});
    }
    let finalScores = [];
    let penMoveRows = mergedData.filter(d => d.mouseUp==1 || d.error==1 || d.allowed==1);
    let lastScoreByTrial = {};
    for (let row of penMoveRows) lastScoreByTrial[row.trial] = row.score;
    let maxTrial = Math.max(...penMoveRows.map(d=>d.trial));
    for(let t=1; t<=maxTrial; ++t) finalScores.push(lastScoreByTrial[t]||0);
    let avg = finalScores.reduce((a,b) => a+b, 0) / finalScores.length;
    let xvals = finalScores.map((_,i)=>i+1);
    Plotly.newPlot(
      'finalPlot',
      [{
        x: xvals,
        y: finalScores,
        type: 'scatter',
        mode:'lines+markers',
        name:'Score',
        marker:{size:10, color:'#1976d2'},
        line:{color:'#1976d2'}
      }],
      {
        margin:{t:30},
        xaxis:{title:'Trial'},
        yaxis:{title:'Score', rangemode:'tozero'},
        title:'Final Score per Trial',
        legend:{x:0.7,y:1.13,orientation:'h'}
      },
      {displayModeBar:false}
    );
    summaryBox.innerHTML = `
      <div>Final scores: ${finalScores.map(s=>s.toFixed(2)).join(', ')}</div>
      <div>Average: <b>${avg.toFixed(2)}</b></div>
      <div style="margin-top:6px;">Experiment finished! Data file downloaded.</div>
    `;

    // Export data to Excel
    let header = ['Trial','Block','Time','MouseX','MouseY','MovementX','MovementY','PenX','PenY','Allowed','MouseUp','Error','Score','Source','Angle','Lag','Sequence','AngularSection'];
    let penMouseRows = [header];
    for(let row of mergedData){
      penMouseRows.push([
        row.trial,
        row.block,
        row.time,
        row.mouseX,
        row.mouseY,
        row.movementX,
        row.movementY,
        row.penX,
        row.penY,
        row.allowed,
        row.mouseUp,
        row.error,
        row.score,
        row.source || '',
        row.rotation,
        row.lag,
        row.sequence,
        row.section
      ]);
    }
    let wb = XLSX.utils.book_new();
    let ws = XLSX.utils.aoa_to_sheet(penMouseRows);
    XLSX.utils.book_append_sheet(wb, ws, "PenAndMouseData");

    let shapeRows = [['Trial','InnerX','InnerY','OuterX','OuterY','MiddleX','MiddleY' ]];
    for(let sh of allShapeData){
      for(let i=0; i<360; i++) {
        shapeRows.push([
          sh.trial,
          sh.inner[i].x,
          sh.inner[i].y,
          sh.outer[i].x,
          sh.outer[i].y,
          sh.middle[i].x,
          sh.middle[i].y
        ]);
      }
    }
    let wsShape = XLSX.utils.aoa_to_sheet(shapeRows);
    XLSX.utils.book_append_sheet(wb, wsShape, "ShapeData");

    let t = new Date();
    let tstr = t.toISOString().replace(/[-T:.Z]/g,'');
    let filename = `SPAT_${user.name || 'anon'}_sequence_${currentSequence}_${tstr}.xlsx`;
    if (document.pointerLockElement) {
      document.exitPointerLock();
      setTimeout(()=>{ XLSX.writeFile(wb, filename); restartBtn.style.display = "block"; }, 200);
    }
    else {
      XLSX.writeFile(wb, filename);
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

    experimentOver = false;
    deductionType = document.querySelector('input[name="deductType"]:checked').value;
    width = user.width;
    score = user.score;
    defaultScore = user.score;
    noiseMag = user.noiseMag;
    pathLength = user.pathLength;
    nSegments = user.nSegments;
    deductError = user.deductError;
    deductTime = user.deductTime;

    // Block sequence initialisation
    currentBlockIdx=0; trialWithinBlock=0;
    if(USE_BLOCKS&&BLOCKS.length>0){
      totalTrials=BLOCKS.reduce((s,b)=>s+b.numTrials,0);
      applyBlockSettings(BLOCKS[0]);          // prime rotation & lag from block 1
    } else {
      totalTrials   =user.trialNum;
      rotationAngle =user.rotation;
      lagMs         =user.lag;
    }

    generateAllAmoebas();  // no-op when FIXED_SHAPE=true
    frontPage.style.display = 'none';
    experimentPage.style.display = 'block';
    trial = 1;
    scoreDisplay.textContent = 'Score: ' + score;
    finalPlotDiv.innerHTML = '';
    summaryBox.innerHTML = '';
    restartBtn.style.display = "none";
    resumeOverlay.style.display = "none";

    canvas = document.getElementById('spatCanvas');
    ctx = canvas.getContext('2d');

    mergedData = [];
    allShapeData = [];
    nextTrial();

    // Set up input handling
    if (inputDevice === 'mouse') {
      attachCanvasListenersMouse();
      setTimeout(()=>{
        let c = document.getElementById('spatCanvas');
        if (document.pointerLockElement !== c) c.requestPointerLock();
      }, 10);
    } else {
      let old = canvas;
      let newCanvas = canvas.cloneNode(true);
      old.parentNode.replaceChild(newCanvas, old);
      canvas = newCanvas;
      ctx = canvas.getContext('2d');
      trialMsg.textContent = 'Connect your gamepad and hold B0 to draw';
      requestAnimationFrame(gamepadLoop);
    }
  };

  // Restarts the experiment.
  restartBtn.onclick = function() {
    experimentOver = false;
    document.getElementById('name').value = user.name || "";
    document.getElementById('inputDevice').value = inputDevice || "mouse";
    document.getElementById('rotation').value = user.rotation || 0;
    document.getElementById('lag').value = user.lag || 0;
    document.getElementById('trialNum').value = user.trialNum || 5;
    document.getElementById('score').value = user.score || 100;
    document.getElementById('deductError').value = user.deductError || 1;
    document.getElementById('deductTime').value = user.deductTime || 0.01;
    document.getElementById('width').value = user.width || 40;
    document.getElementById('noiseMag').value = user.noiseMag || 0.15;
    document.getElementById('pathLength').value = user.pathLength || 1000;
    document.getElementById('nSegments').value = user.nSegments || 30;
    experimentPage.style.display = 'none';
    frontPage.style.display = 'block';
    summaryBox.innerHTML = "";
    finalPlotDiv.innerHTML = "";
    restartBtn.style.display = "none";
    resumeOverlay.style.display = "none";
    drawAmoebaPreview();
    currentBlockIdx=0; trialWithinBlock=0;
    mergedData = [];
    allShapeData = [];
  };

  // Handles pointer lock changes (for mouse input).
  document.addEventListener('pointerlockchange', function() {
    if (!canvas) return;
    drawAmoeba();
    if (document.pointerLockElement !== canvas) {
      if (inputDevice==='mouse' && !experimentOver) {
        drawing = false;
        mouseIsDown = false;
        resumeOverlay.style.display = "flex";
        trialMsg.textContent = '';
      } else {
        resumeOverlay.style.display = "none";
      }
    }
    else {
      resumeOverlay.style.display = "none";
    }
  });
  resumeBtn.onclick = function() {
    if (!canvas) return;
    if (inputDevice==='mouse') canvas.requestPointerLock();
  };
}; // End window.onload
