// ══════════════════════════════════════════════════════════════════════════════
//  EXPERIMENT CONFIGURATION — only edit these two sections
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
  { numTrials: 1, rotation: 0, lag: 0 },
  { numTrials: 1, rotation: 30, lag: 0 },
  { numTrials: 1, rotation: 30, lag: 500 },
  { numTrials: 1, rotation: 0, lag: 0 },
];

const BLOCKS_B = [
  { numTrials: 60, rotation:  0, lag:   0 },
  { numTrials: 80, rotation: 0, lag: 500 },
  { numTrials: 80, rotation:  30, lag: 500 },
  { numTrials: 60, rotation:  0, lag: 0 },
];

let BLOCKS = BLOCKS_A;

// ══════════════════════════════════════════════════════════════════════════════

window.onload = function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let user = {};
  let inputDevice = "mouse";          // mouse | xbox | extreme3dpro
  let trial = 1, totalTrials = 5;
  let score = 100, defaultScore = 100;
  let width = 40, noiseMag = 0.15, pathLength = 1000, nSegments = 30;
  let deductError = 1, deductTime = 0.01;
  let rotationAngle = 0;              // degrees (cursor rotation)
  let lagMs = 0;
  let experimentOver = false;
  let deductionType  = "both";       
  let deductTimer    = null;
  const shapeRadius  = 200;
  const noiseFreq    = 5;
  const numShapes    = 20;
  let canvas, ctx;
  let drawnPath      = [];
  let reachedTarget  = false;
  let amoebaShapes   = [];
  let midPoints = [], outlineOuter = [], outlineInner = [], outlineMiddle = [];
  let startIdx, targetIdx, wallLine = null;
  let penPos         = { x: 0, y: 0 };
  let drawing        = false;
  let mouseIsDown    = false;
  let errorPoints    = [];
  let showErrorCircle= false;
  const center       = { x: 270, y: 270 };
  let mergedData     = [];
  let allShapeData   = [];
  let trialStartTime = null;
  let trialStarted   = false;
  let movementBuffer = [];
  let collisionDetected = false;
  let betweenBlocks = false;
  const RENDER_SCALE = 1.5; // 1.5x larger


  // Fixed-shape: index of start and target in FIXED_MIDDLE_POINTS
  // (findNearestIdx is a function declaration, so it is hoisted and safe to call here)
  let fixedStartIdx  = FIXED_SHAPE ? findNearestIdx(FIXED_MIDDLE_POINTS, FIXED_START_XY[0],  FIXED_START_XY[1])  : 0;
  let fixedTargetIdx = FIXED_SHAPE ? findNearestIdx(FIXED_MIDDLE_POINTS, FIXED_TARGET_XY[0], FIXED_TARGET_XY[1]) : 0;

  // Block-sequence state
  let currentBlockIdx  = 0;
  let trialWithinBlock = 0;

  // Gamepad params
  const GP = { index:0, deadzone:0.12, sensitivity:1.5, invertX:false, invertY:false, activeButton:0 };
  let gpPrevActive = false;

  // ── DOM ────────────────────────────────────────────────────────────────────
  const frontPage      = document.getElementById('frontPage');
  const experimentPage = document.getElementById('experimentPage');
  const form           = document.getElementById('spatForm');
  const trialProgress  = document.getElementById('trialProgress');
  const scoreDisplay   = document.getElementById('scoreDisplay');
  const trialMsg       = document.getElementById('trialMsg');
  const previewCanvas  = document.getElementById('previewCanvas');
  const previewCtx     = previewCanvas.getContext('2d');
  const finalPlotDiv   = document.getElementById('finalPlot');
  const summaryBox     = document.getElementById('summaryBox');
  const restartBtn     = document.getElementById('restartBtn');
  const resumeOverlay  = document.getElementById('resumeOverlay');
  const resumeBtn      = document.getElementById('resumeBtn');
  const sequenceSelectionDiv = document.getElementById('sequenceSelection');
  const sequenceBtnA = document.getElementById('sequenceBtnA');
  const sequenceBtnB = document.getElementById('sequenceBtnB');

  // ── Sequence Selection ─────────────────────────────────────────────────────
  let currentSequence = 'A';  // Track which sequence is active
  
  if (sequenceBtnA) {
    sequenceBtnA.addEventListener('change', function() {
      if (this.checked) {
        BLOCKS = BLOCKS_A;
        console.log('Switched to Sequence A');
      }
    });
  }
 
  if (sequenceBtnB) {
    sequenceBtnB.addEventListener('change', function() {
      if (this.checked) {
        BLOCKS = BLOCKS_B;
        console.log('Switched to Sequence B');
      }
    });
  }
 
  // Initialize with Sequence A (default, as per HTML checked="checked")
  BLOCKS = BLOCKS_A;
 
  // ══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

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
    const d1x=bx-ax, d1y=by-ay, d2x=dx-cx, d2y=dy-cy;
    const cross = d1x*d2y - d1y*d2x;
    if (Math.abs(cross) < 1e-10) return false;
    const tx=cx-ax, ty=cy-ay;
    const t=(tx*d2y-ty*d2x)/cross, u=(tx*d1y-ty*d1x)/cross;
    return t>0 && t<1 && u>=0 && u<=1;
  }

  function isInDrawingArea(x, y) {
    function pip(px, py, poly) {
      let inside = false;
      for (let i=0, j=poly.length-1; i<poly.length; j=i++) {
        const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
        if (((yi>py)!==(yj>py)) && (px<(xj-xi)*(py-yi)/(yj-yi+1e-10)+xi))
          inside=!inside;
      }
      return inside;
    }
    return pip(x, y, outlineOuter) && !pip(x, y, outlineInner);
  }

  function lineIntersectsWall(x1,y1,x2,y2,wx1,wy1,wx2,wy2) {
    function ccw(ax,ay,bx,by,cx,cy){return (cy-ay)*(bx-ax)>(by-ay)*(cx-ax);}
    return (ccw(x1,y1,wx1,wy1,wx2,wy2)!==ccw(x2,y2,wx1,wy1,wx2,wy2))
        && (ccw(x1,y1,x2,y2,wx1,wy1)!==ccw(x1,y1,x2,y2,wx2,wy2));
  }

  function crossesWall(x1,y1,x2,y2) {
    for (let t=0; t<=1; t+=0.2) {
      const px=x1+(x2-x1)*t, py=y1+(y2-y1)*t;
      if (lineIntersectsWall(x1,y1,px,py,wallLine.x1,wallLine.y1,wallLine.x2,wallLine.y2))
        return {x:px,y:py};
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHAPE GENERATION
  // ══════════════════════════════════════════════════════════════════════════

  // Noise-based amoeba (used only when FIXED_SHAPE = false).
  function generateAmoebaShape(seed, widthVal, noiseMagVal, noiseFreqVal, pathLengthVal, nSegmentsVal, cx, cy) {
    let mid=[], totalLen=0, prev=null;
    for (let i=0; i<nSegmentsVal; i++) {
      const theta = 2*Math.PI*i/nSegmentsVal;
      const r = shapeRadius + noiseMagVal*Math.sin(noiseFreqVal*theta + 10*seededRandom(seed+i));
      const x = cx+r*Math.cos(theta), y = cy+r*Math.sin(theta);
      if (prev) totalLen += Math.hypot(x-prev.x, y-prev.y);
      prev={x,y}; mid.push({x,y,theta});
    }
    const scale = pathLengthVal/totalLen;
    for (const pt of mid) { pt.x=cx+(pt.x-cx)*scale; pt.y=cy+(pt.y-cy)*scale; }
    const out=[],inn=[],middle=[];
    for (const pt of mid) {
      const nx=Math.cos(pt.theta), ny=Math.sin(pt.theta);
      out.push   ({x:pt.x+nx*widthVal/2, y:pt.y+ny*widthVal/2});
      middle.push({x:pt.x, y:pt.y});
      inn.push   ({x:pt.x-nx*widthVal/2, y:pt.y-ny*widthVal/2});
    }
    return {midPoints:mid, outlineOuter:out, outlineInner:inn, outlineMiddle:middle};
  }

  function generateAllAmoebas() {
    if (FIXED_SHAPE) return;          // fixed shape needs no pool
    amoebaShapes=[];
    for (let i=0; i<numShapes; i++)
      amoebaShapes.push(generateAmoebaShape(i+100, width, noiseMag*shapeRadius, noiseFreq, pathLength, nSegments, center.x, center.y));
  }

  function pickRandomAmoebaShape() {
    const idx=Math.floor(Math.random()*numShapes);
    midPoints    = amoebaShapes[idx].midPoints;
    outlineOuter = amoebaShapes[idx].outlineOuter;
    outlineInner = amoebaShapes[idx].outlineInner;
    outlineMiddle= amoebaShapes[idx].outlineMiddle;
  }

  // ── Fixed shape: rotate FIXED_MIDDLE_POINTS by a random angle ─────────────
  // Builds the wall line from the current midPoints, startIdx, targetIdx.
  function buildWallLine() {
    const midx=(midPoints[startIdx].x+midPoints[targetIdx].x)/2;
    const midy=(midPoints[startIdx].y+midPoints[targetIdx].y)/2;
    const dx=midPoints[targetIdx].x-midPoints[startIdx].x;
    const dy=midPoints[targetIdx].y-midPoints[startIdx].y;
    const len=Math.hypot(dx,dy), px=-dy/len, py=dx/len;
    const extra=15;
    wallLine={
      x1:midx+px*(width/2+extra), y1:midy+py*(width/2+extra),
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

  // ══════════════════════════════════════════════════════════════════════════
  // OUTLINE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  function resampleOutline(points, numSamples) {
    let dists=[0];
    for (let i=1;i<points.length;i++)
      dists[i]=dists[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
    dists.push(dists[points.length-1]+Math.hypot(points[0].x-points[points.length-1].x,points[0].y-points[points.length-1].y));
    const total=dists[dists.length-1], out=[];
    for (let k=0;k<numSamples;k++) {
      const td=total*k/numSamples;
      let i=0; while(i<dists.length-1&&dists[i+1]<td) i++;
      const t=(td-dists[i])/(dists[i+1]-dists[i]);
      const a=i%points.length, b=(i+1)%points.length;
      out.push({x:points[a].x*(1-t)+points[b].x*t, y:points[a].y*(1-t)+points[b].y*t});
    }
    return out;
  }

  function drawSmoothClosedCurve(ctx, points) {
    if (points.length<2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i=0;i<points.length;i++) {
      const p0=points[i], p1=points[(i+1)%points.length];
      ctx.quadraticCurveTo(p0.x,p0.y,(p0.x+p1.x)/2,(p0.y+p1.y)/2);
    }
    ctx.closePath(); ctx.stroke();
  }

  function drawSmoothOpenCurve(ctx, points) {
    if (points.length<2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i=0;i<points.length-1;i++) {
      const p0=points[i], p1=points[i+1];
      ctx.quadraticCurveTo(p0.x,p0.y,(p0.x+p1.x)/2,(p0.y+p1.y)/2);
    }
    ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
    ctx.stroke();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PREVIEW
  // ══════════════════════════════════════════════════════════════════════════

  function drawAmoebaPreview() {
    const widthP=parseInt(document.getElementById('width').value)||40;
    previewCtx.clearRect(0,0,340,340);
    previewCtx.save();

    let previewOut, previewInn, previewMid;

    if (FIXED_SHAPE) {
      // Scale the fixed shape to fit the 340×340 preview canvas.
      // Shape centre is at (270,270); preview centre is at (170,170).
      const S=0.62;   // fits the ~400px-wide shape with margin
      previewOut=[]; previewInn=[]; previewMid=[];
      for (const pt of FIXED_MIDDLE_POINTS) {
        const px=170+(pt.x-270)*S, py=170+(pt.y-270)*S;
        const hw=widthP/2*S;
        const nx=Math.cos(pt.theta), ny=Math.sin(pt.theta);
        previewOut.push ({x:px+nx*hw, y:py+ny*hw});
        previewMid.push ({x:px,       y:py      });
        previewInn.push ({x:px-nx*hw, y:py-ny*hw});
      }
      // Draw start (blue) and target (red) markers
      const sI=findNearestIdx(FIXED_MIDDLE_POINTS,FIXED_START_XY[0], FIXED_START_XY[1]);
      const tI=findNearestIdx(FIXED_MIDDLE_POINTS,FIXED_TARGET_XY[0],FIXED_TARGET_XY[1]);
      previewCtx.fillStyle='#15616d';
      previewCtx.beginPath();
      previewCtx.arc(previewMid[sI].x,previewMid[sI].y,6,0,2*Math.PI);
      previewCtx.fill();
      previewCtx.fillStyle='#952905';
      previewCtx.beginPath();
      previewCtx.arc(previewMid[tI].x,previewMid[tI].y,6,0,2*Math.PI);
      previewCtx.fill();
    } else {
      const nm =parseFloat(document.getElementById('noiseMag').value)||0.15;
      const pl =parseInt(document.getElementById('pathLength').value)||1000;
      const ns =parseInt(document.getElementById('nSegments').value)||30;
      const sh =generateAmoebaShape(999,widthP,nm*shapeRadius,noiseFreq,pl,ns,170,170);
      previewOut=sh.outlineOuter; previewInn=sh.outlineInner; previewMid=sh.outlineMiddle;
    }

    previewCtx.strokeStyle="#555"; previewCtx.lineWidth=2.2;
    drawSmoothClosedCurve(previewCtx,resampleOutline(previewOut,360));
    previewCtx.strokeStyle="#aaa"; previewCtx.lineWidth=2.2;
    drawSmoothClosedCurve(previewCtx,resampleOutline(previewInn,360));
    previewCtx.strokeStyle="#952905"; previewCtx.lineWidth=2.2;
    drawSmoothClosedCurve(previewCtx,resampleOutline(previewMid,360));
    previewCtx.restore();
  }
  ['width','noiseMag','pathLength','nSegments'].forEach(id=>{
    document.getElementById(id).addEventListener('input',drawAmoebaPreview);
  });
  drawAmoebaPreview();

  // ══════════════════════════════════════════════════════════════════════════
  // TIMING & ROTATION
  // ══════════════════════════════════════════════════════════════════════════

  function startTrialTimer(){ trialStartTime=performance.now(); }
  function getTrialTime(){
    if (!trialStarted||!trialStartTime) return 0;
    return (performance.now()-trialStartTime)/1000;
  }

  // Rotates cursor deltas by the current rotationAngle.
  function rotateDelta(dx,dy){
    const th=rotationAngle*Math.PI/180, c=Math.cos(th), s=Math.sin(th);
    return {dx:c*dx-s*dy, dy:s*dx+c*dy};
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PENALTY
  // ══════════════════════════════════════════════════════════════════════════

  function getPerpendicularDistance(x,y){
    let min=Infinity; const n=outlineMiddle.length;
    for (let i=0;i<n;i++){
      const x1=outlineMiddle[i].x,y1=outlineMiddle[i].y;
      const x2=outlineMiddle[(i+1)%n].x,y2=outlineMiddle[(i+1)%n].y;
      const dx=x2-x1,dy=y2-y1,lsq=dx*dx+dy*dy;
      const t=lsq>0?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/lsq)):0;
      const d=Math.hypot(x-(x1+t*dx),y-(y1+t*dy));
      if(d<min) min=d;
    }
    return min;
  }

  function snapToMiddleLine(x,y){
    let best={x:outlineMiddle[0].x,y:outlineMiddle[0].y},bd=Infinity;
    const n=outlineMiddle.length;
    for(let i=0;i<n;i++){
      const x1=outlineMiddle[i].x,y1=outlineMiddle[i].y;
      const x2=outlineMiddle[(i+1)%n].x,y2=outlineMiddle[(i+1)%n].y;
      const dx=x2-x1,dy=y2-y1,lsq=dx*dx+dy*dy;
      const t=lsq>0?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/lsq)):0;
      const px=x1+t*dx,py=y1+t*dy,d=Math.hypot(x-px,y-py);
      if(d<bd){bd=d;best={x:px,y:py};}
    }
    return best;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DRAWING
  // ══════════════════════════════════════════════════════════════════════════

  function reachedTargetPoint(x,y){
    const t={x:outlineMiddle[targetIdx].x,y:outlineMiddle[targetIdx].y};
    return Math.hypot(x-t.x,y-t.y)<13 && !crossesWall(x,y,t.x,t.y);
  }

  function drawStar(ctx,x,y,spikes,outerR,innerR,color){
    let rot=Math.PI/2*3,step=Math.PI/spikes;
    ctx.save(); ctx.beginPath(); ctx.moveTo(x,y-outerR);
    for(let i=0;i<spikes;i++){
      ctx.lineTo(x+Math.cos(rot)*outerR,y+Math.sin(rot)*outerR); rot+=step;
      ctx.lineTo(x+Math.cos(rot)*innerR,y+Math.sin(rot)*innerR); rot+=step;
    }
    ctx.lineTo(x,y-outerR); ctx.closePath();
    ctx.fillStyle=color; ctx.fill(); ctx.restore();
  }

 function drawAmoeba() {
    // Clear the entire canvas (no scaling applied here)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reset the transformation matrix to default
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Apply scaling and translation
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.translate(
      (canvas.width / RENDER_SCALE - canvas.width) / 2,
      (canvas.height / RENDER_SCALE - canvas.height) / 2
    );
    // Outer & inner borders
    ctx.save();
    ctx.strokeStyle="#555"; ctx.lineWidth=3;
    drawSmoothClosedCurve(ctx,outlineOuter);
    ctx.strokeStyle=" aaa"; ctx.lineWidth=3;
    drawSmoothClosedCurve(ctx,outlineInner);
    ctx.restore();

    // Guide line: visible arc from startIdx forwards to targetIdx
    ctx.save();
    ctx.strokeStyle="#952905"; ctx.lineWidth=3;
    const curve=[outlineMiddle[startIdx]];
    let i=startIdx;
    while(i!==targetIdx){ i=(i+1)%outlineMiddle.length; curve.push(outlineMiddle[i]); }
    drawSmoothOpenCurve(ctx,curve);
    ctx.restore();

    // Wall
    ctx.save();
    ctx.strokeStyle="#952905"; ctx.lineWidth=10;
    ctx.beginPath(); ctx.moveTo(wallLine.x1,wallLine.y1); ctx.lineTo(wallLine.x2,wallLine.y2);
    ctx.stroke(); ctx.restore();

    // Start (blue circle)
    ctx.save(); ctx.fillStyle="#15616d";
    ctx.beginPath(); ctx.arc(outlineMiddle[startIdx].x,outlineMiddle[startIdx].y,10,0,2*Math.PI);
    ctx.fill(); ctx.restore();

    // Target (red star)
    drawStar(ctx,outlineMiddle[targetIdx].x,outlineMiddle[targetIdx].y,5,12,5,"#ff7d00");

    // Drawn path
    if(drawnPath.length>1){
      ctx.save(); ctx.strokeStyle="#15616d"; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(drawnPath[0].x,drawnPath[0].y);
      for(const pt of drawnPath) ctx.lineTo(pt.x,pt.y);
      ctx.stroke(); ctx.restore();
    }

    // Pen cursor
    if(drawing||drawnPath.length){
      ctx.save(); ctx.fillStyle="#4299a6";
      ctx.beginPath(); ctx.arc(penPos.x,penPos.y,7,0,2*Math.PI);
      ctx.fill(); ctx.restore();
    }
  }

  // Trial geometry for noise-based shapes (skipped when FIXED_SHAPE=true).
  function generateTrialGeometry(){
    const minSep=60;
    let dist=0, idx=startIdx=Math.floor(Math.random()*nSegments);
    do{
      const next=(idx-1+nSegments)%nSegments;
      dist+=Math.hypot(midPoints[next].x-midPoints[idx].x,midPoints[next].y-midPoints[idx].y);
      idx=next;
    }while(dist<minSep&&idx!==startIdx);
    targetIdx=idx;
    buildWallLine();
    penPos={x:outlineMiddle[startIdx].x,y:outlineMiddle[startIdx].y};
    drawnPath=[{x:penPos.x,y:penPos.y}];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INPUT HANDLING
  // ══════════════════════════════════════════════════════════════════════════

  function startDeductTimer() {
    if (deductTimer) clearInterval(deductTimer);
    let lastTick = performance.now();
    deductTimer = setInterval(() => {
      if (!drawing) return;
      const now = performance.now(), dt = (now - lastTick) / 1000;
      lastTick = now;
      score = Math.max(0, score - deductTime * dt * 20);
      scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
      if (score <= 0 && !reachedTarget) stopDrawingAndAdvance();
    }, 20);
  }
  function stopDeductTimer(){if(deductTimer) clearInterval(deductTimer); deductTimer=null;}

  function beginDrawingIfNeeded(src){
    if(!trialStarted){startTrialTimer();trialStarted=true;}
    if(!drawing){
      drawing=true; showErrorCircle=false; errorPoints=[];
      mergedData.push({trial,block:currentBlockIdx+1,time:getTrialTime(),
        mouseX:null,mouseY:null,movementX:0,movementY:0,penX:penPos.x,penY:penPos.y,
        allowed:1,mouseUp:0,error:0,score,source:src||'unknown', rotation: rotationAngle,lag: lagMs,sequence: currentSequence});
    }
    startDeductTimer();
  }

  function endDrawingIfNeeded(src){
    if(drawing){
      drawing=false; stopDeductTimer(); showErrorCircle=false;
      mergedData.push({trial,block:currentBlockIdx+1,time:getTrialTime(),
        mouseX:null,mouseY:null,movementX:0,movementY:0,penX:penPos.x,penY:penPos.y,
        allowed:1,mouseUp:1,error:0,score,source:src||'unknown', rotation: rotationAngle,lag: lagMs,sequence: currentSequence});
    }
  }

  function processOneDelta(dx, dy, now, src) {
    if (collisionDetected) return; // Stop if collision already detected

    const rot = rotateDelta(dx, dy);
    dx = rot.dx;
    dy = rot.dy;
    const oldx = penPos.x, oldy = penPos.y;

    // Red wall: block + snap + penalty
    if (wallLine && segmentsIntersect(penPos.x, penPos.y, penPos.x + dx, penPos.y + dy,
        wallLine.x1, wallLine.y1, wallLine.x2, wallLine.y2)) {
      const snap = snapToMiddleLine(penPos.x, penPos.y);
      penPos.x = snap.x;
      penPos.y = snap.y;
      score = Math.max(0, score - deductError); // Deduct for wall hit
      scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
      mergedData.push({
        trial, block: currentBlockIdx + 1, time: getTrialTime(),
        mouseX: null, mouseY: null, movementX: dx, movementY: dy,
        penX: penPos.x, penY: penPos.y, allowed: 0, mouseUp: 0, error: 1, score, source: src || 'unknown', rotation: rotationAngle,lag: lagMs,sequence: currentSequence
      });
      drawnPath.push({ x: penPos.x, y: penPos.y });
      collisionDetected = true; // Stop further movement
      movementBuffer = [];       // Clear buffer
      stopDeductTimer();         // Stop time-based deduction
      endDrawingIfNeeded(src);
      drawAmoeba();
      return;
    }

    // Grey boundaries: block + snap + penalty
    penPos.x += dx;
    penPos.y += dy;
    if (!isInDrawingArea(penPos.x, penPos.y)) {
      const snap = snapToMiddleLine(penPos.x, penPos.y);
      penPos.x = snap.x;
      penPos.y = snap.y;
      score = Math.max(0, score - deductError); // Deduct for boundary hit
      scoreDisplay.textContent = `Score: ${score.toFixed(2)}`;
      mergedData.push({
        trial, block: currentBlockIdx + 1, time: getTrialTime(),
        mouseX: null, mouseY: null, movementX: dx, movementY: dy,
        penX: penPos.x, penY: penPos.y, allowed: 0, mouseUp: 0, error: 1, score, source: src || 'unknown', rotation: rotationAngle,lag: lagMs,sequence: currentSequence
      });
      drawnPath.push({ x: penPos.x, y: penPos.y });
      collisionDetected = true; // Stop further movement
      movementBuffer = [];       // Clear buffer
      stopDeductTimer();         // Stop time-based deduction
      endDrawingIfNeeded(src);
      drawAmoeba();
      return;
    }

    // Normal movement (no time deduction here)
    mergedData.push({
      trial, block: currentBlockIdx + 1, time: getTrialTime(),
      mouseX: null, mouseY: null, movementX: dx, movementY: dy,
      penX: penPos.x, penY: penPos.y, allowed: 1, mouseUp: 0, error: 0, score, source: src || 'unknown', rotation: rotationAngle,lag: lagMs,sequence: currentSequence
    });
    drawnPath.push({ x: penPos.x, y: penPos.y });
    drawAmoeba();

    if (!reachedTarget && reachedTargetPoint(penPos.x, penPos.y)) {
      reachedTarget = true;
      endDrawingIfNeeded(src);
      drawAmoeba();
      setTimeout(() => advanceTrialOrEnd(), 700);
      return;
    }
    if (score <= 0 && !reachedTarget) {
      endDrawingIfNeeded(src);
      setTimeout(() => advanceTrialOrEnd(), 700);
    }
  }

  function stopDrawingAndAdvance(){
    endDrawingIfNeeded('timer'); setTimeout(()=>advanceTrialOrEnd(),700);
  }

  // ── Mouse ─────────────────────────────────────────────────────────────────
  function attachCanvasListenersMouse(){
    const old=canvas,nc=canvas.cloneNode(true);
    old.parentNode.replaceChild(nc,old); canvas=nc; ctx=canvas.getContext('2d');

    canvas.addEventListener('mousedown',(e)=>{
      if(!trialStarted){startTrialTimer();trialStarted=true;}
      collisionDetected=false;
      mouseIsDown=true; beginDrawingIfNeeded('mouse');
      if(drawnPath.length===0){
        penPos={x:outlineMiddle[startIdx].x,y:outlineMiddle[startIdx].y};
        drawnPath=[{x:penPos.x,y:penPos.y}];
      }
      drawAmoeba();
    });
    canvas.addEventListener('mousemove',(e)=>{
      if(document.pointerLockElement!==canvas||!trialStarted||!mouseIsDown||!drawing) return;
      if(collisionDetected) return;
      const now=performance.now();
      if(lagMs>0){
        movementBuffer.push({dx:e.movementX,dy:e.movementY,time:now});
        while(movementBuffer.length&&movementBuffer[0].time<now-lagMs-2000) movementBuffer.shift();
        while(movementBuffer.length&&movementBuffer[0].time<=now-lagMs){
          const mv=movementBuffer.shift(); processOneDelta(mv.dx,mv.dy,now,'mouse');
          if(collisionDetected||!drawing){movementBuffer=[];break;}
        } 
      } else { processOneDelta(e.movementX,e.movementY,now,'mouse'); }
    });
    canvas.addEventListener('mouseup',   ()=>{mouseIsDown=false; endDrawingIfNeeded('mouse'); drawAmoeba();});
    canvas.addEventListener('mouseleave',()=>{mouseIsDown=false; endDrawingIfNeeded('mouse'); drawAmoeba();});
    canvas.addEventListener('mouseenter',(e)=>{if(e.buttons&1) mouseIsDown=true;});
  }

  // ── Gamepad ───────────────────────────────────────────────────────────────
  function gamepadLoop(){
    if(experimentOver) return;
    const dev=inputDevice;
    const pads=navigator.getGamepads?navigator.getGamepads():[];
    const gp=pads&&pads[GP.index]?pads[GP.index]:null;
    if(gp){
      let ax=gp.axes[0]||0, ay=gp.axes[1]||0;
      if(GP.invertX) ax=-ax; if(GP.invertY) ay=-ay;
      if(Math.hypot(ax,ay)<GP.deadzone){ax=0;ay=0;}
      const dx=ax*GP.sensitivity, dy=ay*GP.sensitivity;
      const active=!!(gp.buttons&&gp.buttons[GP.activeButton]&&gp.buttons[GP.activeButton].pressed);

      if(active&&!gpPrevActive){
        collisionDetected=false;
        if(!trialStarted){startTrialTimer();trialStarted=true;}
        beginDrawingIfNeeded(dev);
        if(drawnPath.length===0){
          penPos={x:outlineMiddle[startIdx].x,y:outlineMiddle[startIdx].y};
          drawnPath=[{x:penPos.x,y:penPos.y}];
        }
      }
      if(!active&&gpPrevActive) endDrawingIfNeeded(dev);
      if(active&&drawing&&!collisionDetected){
        const now=performance.now();
        if(lagMs>0){
          movementBuffer.push({dx,dy,time:now});
          while(movementBuffer.length&&movementBuffer[0].time<now-lagMs-2000) movementBuffer.shift();
          while(movementBuffer.length&&movementBuffer[0].time<=now-lagMs){
            const mv=movementBuffer.shift(); processOneDelta(mv.dx,mv.dy,now,dev);
            if(collisionDetected||!drawing){movementBuffer=[];break;}
          }
        } else { processOneDelta(dx,dy,now,dev); }
      }
      gpPrevActive=active;
    }
    drawAmoeba(); requestAnimationFrame(gamepadLoop);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK SEQUENCE
  // ══════════════════════════════════════════════════════════════════════════

  function applyBlockSettings(block){
    rotationAngle = block.rotation;
    lagMs         = block.lag;
  }

  function showBlockCountdown(seconds, onDone) {
    // pointer lock intentionally kept active during countdown
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
        // no requestPointerLock needed — lock was never released
      }
    }, 1000);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TRIAL FLOW
  // ══════════════════════════════════════════════════════════════════════════

  function nextTrial(){
    // Archive shape from trial that just ended
    if(trial>1&&outlineOuter&&outlineInner){
      allShapeData.push({
        trial:trial-1,
        inner :resampleOutline(outlineInner, 360),
        outer :resampleOutline(outlineOuter, 360),
        middle:resampleOutline(outlineMiddle,360)
      });
    }
    collisionDetected = false;
    trialMsg.textContent='';
    trialProgress.textContent = USE_BLOCKS&&BLOCKS.length
      ? `Block ${currentBlockIdx+1}/${BLOCKS.length} — Trial ${trial} of ${totalTrials}`
      : `Trial ${trial} of ${totalTrials}`;

    score=defaultScore; scoreDisplay.textContent=`Score: ${score}`;
    drawnPath=[]; errorPoints=[]; reachedTarget=false;
    movementBuffer=[]; gpPrevActive=false; collisionDetected=false;

    if(FIXED_SHAPE){
      applyFixedShapeForTrial();   // random rotation, fixed indices
    } else {
      pickRandomAmoebaShape();
      generateTrialGeometry();
    }

    drawAmoeba(); trialStarted=false;
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

  // ══════════════════════════════════════════════════════════════════════════
  // END EXPERIMENT
  // ══════════════════════════════════════════════════════════════════════════

function endExperiment() {
  experimentOver = true;
  if (outlineOuter && outlineInner) {
    allShapeData.push({
      trial,
      inner: resampleOutline(outlineInner, 360),
      outer: resampleOutline(outlineOuter, 360),
      middle: resampleOutline(outlineMiddle, 360)
    });
  }

  const pmRows = mergedData.filter(d => d.mouseUp == 1 || d.error == 1 || d.allowed == 1);
  const lastScore = {};
  for (const r of pmRows) lastScore[r.trial] = r.score;
  const maxT = Math.max(...pmRows.map(d => d.trial));
  const finals = [];
  for (let t = 1; t <= maxT; t++) finals.push(lastScore[t] || 0);
  const avg = finals.reduce((a, b) => a + b, 0) / finals.length;

  Plotly.newPlot('finalPlot', [{
    x: finals.map((_, i) => i + 1),
    y: finals,
    type: 'scatter',
    mode: 'lines+markers',
    name: 'Score',
    marker: { size: 10, color: '#15616d' },
    line: { color: '#15616d' }
  }], {
    margin: { t: 30 },
    xaxis: { title: 'Trial' },
    yaxis: { title: 'Score', rangemode: 'tozero' },
    title: 'Final Score per Trial',
    legend: { x: 0.7, y: 1.13, orientation: 'h' }
  }, { displayModeBar: false });

  summaryBox.innerHTML = `
    <div>Final scores: ${finals.map(s => s.toFixed(2)).join(', ')}</div>
    <div>Average: <b>${avg.toFixed(2)}</b></div>
    <div style="margin-top:6px;">Experiment finished! Data file downloaded.</div>`;

  // ── Excel export ──────────────────────────────────────────────────────
  // Add 'Angle' and 'Lag' to the header
  const hdr = [
    'Trial', 'Block', 'Time', 'MouseX', 'MouseY', 'MovementX', 'MovementY',
    'PenX', 'PenY', 'Allowed', 'MouseUp', 'Error', 'Score', 'Source', 'Angle', 'Lag', 'Sequence'
  ];
  const dataRows = [hdr];

  // Add rotationAngle and lagMs to each row
  for (const r of mergedData) {
    dataRows.push([
      r.trial, r.block, r.time, r.mouseX, r.mouseY,
      r.movementX, r.movementY, r.penX, r.penY,
      r.allowed, r.mouseUp, r.error, r.score, r.source || '',
      r.rotation, r.lag, r.sequence
    ]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dataRows), "PenAndMouseData");

  const shRows = [['Trial', 'InnerX', 'InnerY', 'OuterX', 'OuterY', 'MiddleX', 'MiddleY']];
  for (const sh of allShapeData) {
    for (let i = 0; i < 360; i++) {
      shRows.push([
        sh.trial, sh.inner[i].x, sh.inner[i].y,
        sh.outer[i].x, sh.outer[i].y, sh.middle[i].x, sh.middle[i].y
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(shRows), "ShapeData");

  const ts = new Date().toISOString().replace(/[-T:.Z]/g, '');
  const fn = `SPAT_${user.name || 'anon'}_sequence_${currentSequence}_${ts}.xlsx`;
  if (document.pointerLockElement) {
    document.exitPointerLock();
    setTimeout(() => { XLSX.writeFile(wb, fn); restartBtn.style.display = "block"; }, 200);
  } else {
    XLSX.writeFile(wb, fn);
    restartBtn.style.display = "block";
  }
}


  // ══════════════════════════════════════════════════════════════════════════
  // FORM SUBMIT
  // ══════════════════════════════════════════════════════════════════════════

  form.onsubmit=function(e){
    e.preventDefault();
    user.name       =document.getElementById('name').value||'';
    inputDevice     =document.getElementById('inputDevice').value;
    user.rotation   =parseFloat(document.getElementById('rotation').value)||0;
    user.lag        =parseInt(document.getElementById('lag').value)||0;
    user.trialNum   =parseInt(document.getElementById('trialNum').value)||5;
    user.width      =parseInt(document.getElementById('width').value)||40;
    user.score      =parseInt(document.getElementById('score').value)||100;
    user.deductError=parseFloat(document.getElementById('deductError').value)||5;
    user.deductTime =parseFloat(document.getElementById('deductTime').value)||0.01;
    user.noiseMag   =parseFloat(document.getElementById('noiseMag').value)||0.15;
    user.pathLength =parseInt(document.getElementById('pathLength').value)||1000;
    user.nSegments  =parseInt(document.getElementById('nSegments').value)||30;

    experimentOver=false;
    width         =user.width;
    score         =user.score; defaultScore=user.score;
    noiseMag      =user.noiseMag; pathLength=user.pathLength; nSegments=user.nSegments;
    deductError   =user.deductError; deductTime=user.deductTime;

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

    frontPage.style.display='none'; experimentPage.style.display='block';
    trial=1; scoreDisplay.textContent='Score: '+score;
    finalPlotDiv.innerHTML=''; summaryBox.innerHTML='';
    restartBtn.style.display='none'; resumeOverlay.style.display='none';

    canvas=document.getElementById('spatCanvas'); ctx=canvas.getContext('2d');
    mergedData=[]; allShapeData=[];
    nextTrial();

    if(inputDevice==='mouse'){
      attachCanvasListenersMouse();
      setTimeout(()=>{
        const c=document.getElementById('spatCanvas');
        if(document.pointerLockElement!==c) c.requestPointerLock();
      },10);
    } else {
      const old=canvas,nc=canvas.cloneNode(true);
      old.parentNode.replaceChild(nc,old); canvas=nc; ctx=canvas.getContext('2d');
      trialMsg.textContent='Connect your gamepad and hold B0 to draw';
      requestAnimationFrame(gamepadLoop);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RESTART & POINTER LOCK
  // ══════════════════════════════════════════════════════════════════════════

  restartBtn.onclick=function(){
    experimentOver=false;
    document.getElementById('name').value        =user.name||"";
    document.getElementById('inputDevice').value =inputDevice||"mouse";
    document.getElementById('rotation').value    =user.rotation||0;
    document.getElementById('lag').value         =user.lag||0;
    document.getElementById('trialNum').value    =user.trialNum||5;
    document.getElementById('score').value       =user.score||100;
    document.getElementById('deductError').value =user.deductError||2;
    document.getElementById('deductTime').value  =user.deductTime||0.01;
    document.getElementById('width').value       =user.width||40;
    document.getElementById('noiseMag').value    =user.noiseMag||0.15;
    document.getElementById('pathLength').value  =user.pathLength||1000;
    document.getElementById('nSegments').value   =user.nSegments||30;
    experimentPage.style.display='none'; frontPage.style.display='block';
    summaryBox.innerHTML=""; finalPlotDiv.innerHTML="";
    restartBtn.style.display="none"; resumeOverlay.style.display="none";
    currentBlockIdx=0; trialWithinBlock=0;
    mergedData=[]; allShapeData=[];
    drawAmoebaPreview();
  };

  document.addEventListener('pointerlockchange',function(){
    if(!canvas) return;
    drawAmoeba();
    if(document.pointerLockElement!==canvas){
    if(inputDevice==='mouse'&&!experimentOver){
        drawing=false; mouseIsDown=false;
        resumeOverlay.style.display='flex'; trialMsg.textContent='';
      }
      else { resumeOverlay.style.display='none'; }
    } else { resumeOverlay.style.display='none'; }
  });

  resumeBtn.onclick=function(){
    if(!canvas) return;
    if(inputDevice==='mouse') canvas.requestPointerLock();
  };

}; // end window.onload