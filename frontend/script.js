/**
 * Draw Road Network
 */
id = Math.random().toString(36).substring(2, 15);

BACKGROUND_COLOR = 0xe8ebed;
LANE_COLOR = 0x586970;
LANE_BORDER_WIDTH = 1;
LANE_BORDER_COLOR = 0x82a8ba;
LANE_INNER_COLOR = 0xbed8e8;
LANE_DASH = 10;
LANE_GAP = 12;
TRAFFIC_LIGHT_WIDTH = 3;
MAX_TRAFFIC_LIGHT_NUM = 100000;
ROTATE = 90;

CAR_LENGTH = 5;
CAR_WIDTH = 2;
CAR_COLOR = 0xe8bed4;

CAR_COLORS = [0xf2bfd7, // pink
            0xb7ebe4,   // cyan
            0xdbebb7,   // blue
            0xf5ddb5, 
            0xd4b5f5];
CAR_COLORS_NUM = CAR_COLORS.length;

// Visual settings — controlled by the Settings panel in the UI
var LANE_WIDTH_SCALE  = 1.0;
var CAR_SIZE_OVERRIDE = false;
var CAR_LENGTH_CUSTOM = 5;
var CAR_WIDTH_CUSTOM  = 2;
var VEHICLE_DENSITY   = 1.0;   // 0.1 – 1.0  (fraction of vehicles to display)
var LANE_DIVIDER_INSET = 0;    // perpendicular offset of divider line from lane boundary

NUM_CAR_POOL = 150000;

LIGHT_RED = 0xdb635e;
LIGHT_GREEN = 0x85ee00;

TURN_SIGNAL_COLOR = 0xFFFFFF;
TURN_SIGNAL_WIDTH   = 1;
TURN_SIGNAL_LENGTH  = 5;

var simulation, roadnet, steps;
var nodes = {};
var edges = {};
var logs;
var gettingLog = false;

let Application = PIXI.Application,
    Sprite = PIXI.Sprite,
    Graphics = PIXI.Graphics,
    Container = PIXI.Container,
    ParticleContainer = PIXI.particles.ParticleContainer,
    Texture = PIXI.Texture,
    Rectangle = PIXI.Rectangle
;

var controls = new function () {
    this.replaySpeedMax = 1;
    this.replaySpeedMin = 0.01;
    this.replaySpeed = 0.5;
    this.paused = false;
};

var trafficLightsG = {};

var app, viewport, renderer, simulatorContainer, carContainer, trafficLightContainer;
var turnSignalContainer;
var carPool;

var cnt = 0;
var frameElapsed = 0;
var totalStep;

var nodeCarNum = document.getElementById("car-num");
var nodeProgressPercentage = document.getElementById("progress-percentage");
var nodeTotalStep = document.getElementById("total-step-num");
var nodeCurrentStep = document.getElementById("current-step-num");
var nodeSelectedEntity = document.getElementById("selected-entity");

var SPEED = 3, SCALE_SPEED = 1.01;
var LEFT = 37, UP = 38, RIGHT = 39, DOWN = 40;
var MINUS = 189, EQUAL = 187, P = 80;
var LEFT_BRACKET = 219, RIGHT_BRACKET = 221; 
var ONE = 49, TWO = 50;
var SPACE = 32;

var keyDown = new Set();

var turnSignalTextures = [];

let pauseButton = document.getElementById("pause");
let nodeCanvas = document.getElementById("simulator-canvas");
let replayControlDom = document.getElementById("replay-control");
let replaySpeedDom = document.getElementById("replay-speed");

let loading = false;
let infoDOM = document.getElementById("info");
let selectedDOM = document.getElementById("selected-entity");

function infoAppend(msg) {
    infoDOM.innerText += "- " + msg + "\n";
}

function infoReset() {
    infoDOM.innerText = "";
}

/**
 * Upload files
 */
let ready = false;

let roadnetData = [];
let replayData = [];
let chartData = [];

function handleChooseFile(v, label_dom) {
    return function(evt) {
        let file = evt.target.files[0];
        label_dom.innerText = file.name;
    }
}

function uploadFile(v, file, callback) {
    let reader = new FileReader();
    reader.onloadstart = function () {
        infoAppend("Loading " + file.name);
    };
    reader.onerror = function() {
        infoAppend("Loading " + file.name + "failed");
    }
    reader.onload = function (e) {
        infoAppend(file.name + " loaded");
        v[0] = e.target.result;
        callback();
    };
    try {
        reader.readAsText(file);
    } catch (e) {
        infoAppend("Loading failed");
        console.error(e.message);
    }
}

let debugMode = false;
let chartLog;
let showChart = false;
let chartConainterDOM = document.getElementById("chart-container");
function start() {
    if (loading) return;
    loading = true;
    infoReset();
    uploadFile(roadnetData, RoadnetFileDom.files[0], function(){
    uploadFile(replayData, ReplayFileDom.files[0], function(){
        let after_update = function() {
            infoAppend("drawing roadnet");
            ready = false;
            document.getElementById("guide").classList.add("d-none");
            hideCanvas();
            try {
                simulation = JSON.parse(roadnetData[0]);
            } catch (e) {
                infoAppend("Parsing roadnet file failed");
                loading = false;
                return;
            }
            try {
                logs = replayData[0].split('\n');
                logs.pop();
            } catch (e) {
                infoAppend("Reading replay file failed");
                loading = false;
                return;
            }

            totalStep = logs.length;
            if (showChart) {
                chartConainterDOM.classList.remove("d-none");
                let chart_lines = chartData[0].split('\n');
                if (chart_lines.length == 0) {
                    infoAppend("Chart file is empty");
                    showChart = false;
                }
                chartLog = [];
                for (let i = 0 ; i < totalStep ; ++i) {
                    step_data = chart_lines[i + 1].split(/[ \t]+/);
                    chartLog.push([]);
                    for (let j = 0; j < step_data.length; ++j) {
                        chartLog[i].push(parseFloat(step_data[j]));
                    }
                }
                chart.init(chart_lines[0], chartLog[0].length, totalStep);
            }else {
                chartConainterDOM.classList.add("d-none");
            }

            controls.paused = false;
            cnt = 0;
            debugMode = document.getElementById("debug-mode").checked;
            setTimeout(function () {
                try {
                    drawRoadnet();
                } catch (e) {
                    infoAppend("Drawing roadnet failed");
                    console.error(e.message);
                    loading = false;
                    return;
                }
                ready = true;
                loading = false;
                infoAppend("Start replaying");
            }, 200);
        };


        if (ChartFileDom.value) {
            showChart = true;
            uploadFile(chartData, ChartFileDom.files[0], after_update);
        } else {
            showChart = false;
            after_update();
        }

    }); // replay callback
    }); // roadnet callback
}

let RoadnetFileDom = document.getElementById("roadnet-file");
let ReplayFileDom = document.getElementById("replay-file");
let ChartFileDom = document.getElementById("chart-file");

RoadnetFileDom.addEventListener("change",
    handleChooseFile(roadnetData, document.getElementById("roadnet-label")), false);
ReplayFileDom.addEventListener("change",
    handleChooseFile(replayData, document.getElementById("replay-label")), false);
ChartFileDom.addEventListener("change",
    handleChooseFile(chartData, document.getElementById("chart-label")), false);

document.getElementById("start-btn").addEventListener("click", start);

document.getElementById("slow-btn").addEventListener("click", function() {
    updateReplaySpeed(controls.replaySpeed - 0.1);
})

document.getElementById("fast-btn").addEventListener("click", function() {
    updateReplaySpeed(controls.replaySpeed + 0.1);
})

function updateReplaySpeed(speed){
    speed = Math.min(speed, 1);
    speed = Math.max(speed, 0);
    controls.replaySpeed = speed;
    replayControlDom.value = speed * 100;
    replaySpeedDom.innerHTML = speed.toFixed(2);
}

updateReplaySpeed(0.5);

replayControlDom.addEventListener('change', function(e){
    updateReplaySpeed(replayControlDom.value / 100);
});

document.addEventListener('keydown', function(e) {
    if (e.keyCode == P) {
        controls.paused = !controls.paused;
    } else if (e.keyCode == ONE) {
        updateReplaySpeed(Math.max(controls.replaySpeed / 1.5, controls.replaySpeedMin));
    } else if (e.keyCode == TWO ) {
        updateReplaySpeed(Math.min(controls.replaySpeed * 1.5, controls.replaySpeedMax));
    } else if (e.keyCode == LEFT_BRACKET) {
        cnt = (cnt - 1) % totalStep;
        cnt = (cnt + totalStep) % totalStep;
        drawStep(cnt);
    } else if (e.keyCode == RIGHT_BRACKET) {
        cnt = (cnt + 1) % totalStep;
        drawStep(cnt);
    } else {
        keyDown.add(e.keyCode)
    }
});

document.addEventListener('keyup', (e) => keyDown.delete(e.keyCode));

nodeCanvas.addEventListener('dblclick', function(e){
    controls.paused = !controls.paused;
});

pauseButton.addEventListener('click', function(e){
    controls.paused = !controls.paused;
});

function initCanvas() {
    app = new Application({
        width: nodeCanvas.offsetWidth,
        height: nodeCanvas.offsetHeight,
        transparent: false,
        backgroundColor: BACKGROUND_COLOR
    });

    nodeCanvas.appendChild(app.view);
    app.view.classList.add("d-none");

    renderer = app.renderer;
    renderer.interactive = true;
    renderer.autoResize = true;

    renderer.resize(nodeCanvas.offsetWidth, nodeCanvas.offsetHeight);
    app.ticker.add(run);
}

function showCanvas() {
    document.getElementById("spinner").classList.add("d-none");
    app.view.classList.remove("d-none");
}

function hideCanvas() {
    document.getElementById("spinner").classList.remove("d-none");
    app.view.classList.add("d-none");
}

function drawRoadnet() {
    if (simulatorContainer) {
        simulatorContainer.destroy(true);
    }
    app.stage.removeChildren();
    viewport = new Viewport.Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        interaction: app.renderer.plugins.interaction
    });
    viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate();
    app.stage.addChild(viewport);
    simulatorContainer = new Container();
    viewport.addChild(simulatorContainer);

    roadnet = JSON.parse(JSON.stringify(simulation.static));
    nodes = [];
    edges = [];
    trafficLightsG = {};

    for (let i = 0, len = roadnet.nodes.length;i < len;++i) {
        node = roadnet.nodes[i];
        node.point = new Point(transCoord(node.point));
        nodes[node.id] = node;
    }

    for (let i = 0, len = roadnet.edges.length;i < len;++i) {
        edge = roadnet.edges[i];
        edge.from = nodes[edge.from];
        edge.to = nodes[edge.to];
        for (let j = 0, len = edge.points.length;j < len;++j) {
            edge.points[j] = new Point(transCoord(edge.points[j]));
        }
        edges[edge.id] = edge;
    }

    // Build road-segment spatial index used by scaledCarPos().
    // Each entry stores the segment's unit direction and its left-hand
    // perpendicular (rotate 90° = [-ddy, ddx]) in screen coordinates.
    window.roadSegIndex = [];
    window.roadSegMaxWidth = 0;
    for (let eid in edges) {
        let ed = edges[eid];
        let roadW = ed.laneWidths.reduce((a, b) => a + b, 0);
        if (roadW > window.roadSegMaxWidth) window.roadSegMaxWidth = roadW;

        for (let i = 1; i < ed.points.length; i++) {
            let p1 = ed.points[i-1], p2 = ed.points[i];
            let dx = p2.x - p1.x, dy = p2.y - p1.y;
            let len = Math.sqrt(dx*dx + dy*dy);
            if (len < 0.001) continue;
            dx /= len; dy /= len;
            window.roadSegIndex.push({
                p1x: p1.x, p1y: p1.y,
                ddx: dx,   ddy: dy,
                px: -dy,   py:  dx,
                len
            });
        }
    }

    // Store non-virtual node positions for intersection car scaling
    window.nodePositions = [];
    for (let nid in nodes) {
        let nd = nodes[nid];
        window.nodePositions.push({ x: nd.point.x, y: nd.point.y });
    }

    /**
     * Draw Map
     */
    trafficLightContainer = new ParticleContainer(MAX_TRAFFIC_LIGHT_NUM, {tint: true});
    let mapContainer, mapGraphics;
    if (debugMode) {
        mapContainer = new Container();
        simulatorContainer.addChild(mapContainer);
    }else {
        mapGraphics = new Graphics();
        simulatorContainer.addChild(mapGraphics);
    }

    for (nodeId in nodes) {
        if (!nodes[nodeId].virtual) {
            let nodeGraphics;
            if (debugMode) {
                nodeGraphics = new Graphics();
                mapContainer.addChild(nodeGraphics);
            } else {
                nodeGraphics = mapGraphics;
            }
            drawNode(nodes[nodeId], nodeGraphics);
        }
    }
    // Create traffic light texture ONCE — ParticleContainer requires all
    // sprites to share the same base texture; creating one per edge caused
    // road/light overlap rendering artifacts.
    let lightGOnce = new Graphics();
    lightGOnce.lineStyle(TRAFFIC_LIGHT_WIDTH, 0xFFFFFF);
    lightGOnce.drawLine(new Point(0, 0), new Point(1, 0));
    lightTexture = renderer.generateTexture(lightGOnce);

    for (edgeId in edges) {
        let edgeGraphics;
        if (debugMode) {
            edgeGraphics = new Graphics();
            mapContainer.addChild(edgeGraphics);
        } else {
            edgeGraphics = mapGraphics;
        }
        drawEdge(edges[edgeId], edgeGraphics);
    }
    let bounds = simulatorContainer.getBounds();
    simulatorContainer.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    simulatorContainer.position.set(renderer.width / 2, renderer.height / 2);
    simulatorContainer.addChild(trafficLightContainer);

    /**
     * Settings for Cars
     */
    TURN_SIGNAL_LENGTH = CAR_LENGTH;
    TURN_SIGNAL_WIDTH  = CAR_WIDTH / 2;

    var carG = new Graphics();
    carG.lineStyle(0);
    carG.beginFill(0xFFFFFF, 0.8);
    carG.drawRect(0, 0, CAR_LENGTH, CAR_WIDTH);

    let carTexture = renderer.generateTexture(carG);

    let signalG = new Graphics();
    signalG.beginFill(TURN_SIGNAL_COLOR, 0.7).drawRect(0,0, TURN_SIGNAL_LENGTH, TURN_SIGNAL_WIDTH)
           .drawRect(0, 3 * CAR_WIDTH - TURN_SIGNAL_WIDTH, TURN_SIGNAL_LENGTH, TURN_SIGNAL_WIDTH).endFill();
    let turnSignalTexture = renderer.generateTexture(signalG);

    let signalLeft = new Texture(turnSignalTexture, new Rectangle(0, 0, TURN_SIGNAL_LENGTH, CAR_WIDTH));
    let signalStraight = new Texture(turnSignalTexture, new Rectangle(0, CAR_WIDTH, TURN_SIGNAL_LENGTH, CAR_WIDTH));
    let signalRight = new Texture(turnSignalTexture, new Rectangle(0, CAR_WIDTH * 2, TURN_SIGNAL_LENGTH, CAR_WIDTH));
    turnSignalTextures = [signalLeft, signalStraight, signalRight];


    carPool = [];
    if (debugMode)
        carContainer = new Container();
    else
        carContainer = new ParticleContainer(NUM_CAR_POOL, {rotation: true, tint: true});


    turnSignalContainer = new ParticleContainer(NUM_CAR_POOL, {rotation: true, tint: true});
    simulatorContainer.addChild(carContainer);
    simulatorContainer.addChild(turnSignalContainer);
    for (let i = 0, len = NUM_CAR_POOL;i < len;++i) {
        //var car = Sprite.fromImage("images/car.png")
        let car = new Sprite(carTexture);
        let signal = new Sprite(turnSignalTextures[1]);
        car.anchor.set(1, 0.5);

        if (debugMode) {
            car.interactive = true;
            car.on('mouseover', function () {
                selectedDOM.innerText = car.name;
                car.alpha = 0.8;
            });
            car.on('mouseout', function () {
                // selectedDOM.innerText = "";
                car.alpha = 1;
            });
        }
        signal.anchor.set(1, 0.5);
        carPool.push([car, signal]);
    }
    showCanvas();

    return true;
}

function appendText(id, text) {
    let p = document.createElement("span");
    p.innerText = text;
    document.getElementById("info").appendChild(p);
    document.getElementById("info").appendChild(document.createElement("br"));
}

var statsFile = "";
var withRange = false;
var nodeStats, nodeRange;

initCanvas();


function transCoord(point) {
    return [point[0], -point[1]];
}

PIXI.Graphics.prototype.drawLine = function(pointA, pointB) {
    this.moveTo(pointA.x, pointA.y);
    this.lineTo(pointB.x, pointB.y);
}

PIXI.Graphics.prototype.drawDashLine = function(pointA, pointB, dash = 16, gap = 8) {
    let direct = pointA.directTo(pointB);
    let distance = pointA.distanceTo(pointB);

    let currentPoint = pointA;
    let currentDistance = 0;
    let length;
    let finish = false;
    while (true) {
        this.moveTo(currentPoint.x, currentPoint.y);
        if (currentDistance + dash >= distance) {
            length = distance - currentDistance;
            finish = true;
        } else {
            length = dash
        }
        currentPoint = currentPoint.moveAlong(direct, length);
        this.lineTo(currentPoint.x, currentPoint.y);
        if (finish) break;
        currentDistance += length;

        if (currentDistance + gap >= distance) {
            break;
        } else {
            currentPoint = currentPoint.moveAlong(direct, gap);
            currentDistance += gap;
        }
    }
};

function drawNode(node, graphics) {
    graphics.beginFill(LANE_COLOR);
    let outline = node.outline;
    // node.point is already in screen coords (transCoord applied in drawRoadnet)
    let cx = node.point.x, cy = node.point.y;
    let scaledOutline = [];

    for (let i = 0; i < outline.length; i += 2) {
        // Convert outline vertex to screen coords (y-flip) then scale from node centre
        let ox = outline[i];
        let oy = -outline[i + 1];
        let sx = cx + (ox - cx) * LANE_WIDTH_SCALE;
        let sy = cy + (oy - cy) * LANE_WIDTH_SCALE;
        scaledOutline.push(sx, sy);
        if (i == 0)
            graphics.moveTo(sx, sy);
        else
            graphics.lineTo(sx, sy);
    }
    graphics.endFill();

    if (debugMode) {
        graphics.hitArea = new PIXI.Polygon(scaledOutline);
        graphics.interactive = true;
        graphics.on("mouseover", function () {
            selectedDOM.innerText = node.id;
            graphics.alpha = 0.5;
        });
        graphics.on("mouseout", function () {
            graphics.alpha = 1;
        });
    }
}

function drawEdge(edge, graphics) {
    let from = edge.from;
    let to = edge.to;
    let points = edge.points;

    let pointA, pointAOffset, pointB, pointBOffset;
    let prevPointBOffset = null;

    let scaledLaneWidths = edge.laneWidths.map(w => w * LANE_WIDTH_SCALE);
    let roadWidth = 0;
    scaledLaneWidths.forEach(function(l){
        roadWidth += l;
    }, 0);

    let coords = [], coords1 = [];

    for (let i = 1;i < points.length;++i) {
        if (i == 1){
            pointA = points[0].moveAlongDirectTo(points[1], from.virtual ? 0 : from.width * LANE_WIDTH_SCALE);
            pointAOffset = points[0].directTo(points[1]).rotate(ROTATE);
        } else {
            pointA = points[i-1];
            pointAOffset = prevPointBOffset;
        }
        if (i == points.length - 1) {
            pointB = points[i].moveAlongDirectTo(points[i-1], to.virtual ? 0 : to.width * LANE_WIDTH_SCALE);
            pointBOffset = points[i-1].directTo(points[i]).rotate(ROTATE);
        } else {
            pointB = points[i];
            pointBOffset = points[i-1].directTo(points[i+1]).rotate(ROTATE);
        }
        prevPointBOffset = pointBOffset;

        // Draw Traffic Lights
        if (i == points.length-1 && !to.virtual) {
            edgeTrafficLights = [];
            prevOffset = offset = 0;
            for (lane = 0;lane < edge.nLane;++lane) {
                offset += scaledLaneWidths[lane];
                var light = new Sprite(lightTexture);
                light.anchor.set(0, 0.5);
                light.scale.set(offset - prevOffset, 1);
                point_ = pointB.moveAlong(pointBOffset, prevOffset);
                light.position.set(point_.x, point_.y);
                light.rotation = pointBOffset.getAngleInRadians();
                edgeTrafficLights.push(light);
                prevOffset = offset;
                trafficLightContainer.addChild(light);
            }
            trafficLightsG[edge.id] = edgeTrafficLights;
        }

        // Draw Roads
        graphics.lineStyle(LANE_BORDER_WIDTH, LANE_BORDER_COLOR, 1);
        graphics.drawLine(pointA, pointB);

        pointA1 = pointA.moveAlong(pointAOffset, roadWidth);
        pointB1 = pointB.moveAlong(pointBOffset, roadWidth);

        graphics.lineStyle(0);
        graphics.beginFill(LANE_COLOR);

        coords = coords.concat([pointA.x, pointA.y, pointB.x, pointB.y]);
        coords1 = coords1.concat([pointA1.y, pointA1.x, pointB1.y, pointB1.x]);

        graphics.drawPolygon([pointA.x, pointA.y, pointB.x, pointB.y, pointB1.x, pointB1.y, pointA1.x, pointA1.y]);
        graphics.endFill();

        offset = 0;
        for (let lane = 0, len = edge.nLane-1;lane < len;++lane) {
            offset += scaledLaneWidths[lane];
            graphics.lineStyle(LANE_BORDER_WIDTH, LANE_INNER_COLOR);
            let divOffset = offset + LANE_DIVIDER_INSET;
            graphics.drawDashLine(pointA.moveAlong(pointAOffset, divOffset), pointB.moveAlong(pointBOffset, divOffset), LANE_DASH, LANE_GAP);
        }

        offset += scaledLaneWidths[edge.nLane-1];

        // graphics.lineStyle(LANE_BORDER_WIDTH, LANE_BORDER_COLOR);
        // graphics.drawLine(pointA.moveAlong(pointAOffset, offset), pointB.moveAlong(pointBOffset, offset));
    }

    if (debugMode) {
        coords = coords.concat(coords1.reverse());
        graphics.interactive = true;
        graphics.hitArea = new PIXI.Polygon(coords);
        graphics.on("mouseover", function () {
            graphics.alpha = 0.5;
            selectedDOM.innerText = edge.id;
        });

        graphics.on("mouseout", function () {
            graphics.alpha = 1;
        });
    }
}

function run(delta) {
    let redraw = false;

    if (ready && (!controls.paused || redraw)) {
        try {
            drawStep(cnt);
        }catch (e) {
            infoAppend("Error occurred when drawing");
            ready = false;
        }
        if (!controls.paused) {
            frameElapsed += 1;
            if (frameElapsed >= 1 / controls.replaySpeed ** 2) {
                cnt += 1;
                frameElapsed = 0;
                if (cnt == totalStep) cnt = 0;
            }
        }
    }
}

function _statusToColor(status) {
    switch (status) {
        case 'r':
            return LIGHT_RED;
        case 'g':
            return LIGHT_GREEN;
        default:
            return 0x808080;  
    }
}

function stringHash(str) {
    let hash = 0;
    let p = 127, p_pow = 1;
    let m = 1e9 + 9;
    for (let i = 0; i < str.length; i++) {
        hash = (hash + str.charCodeAt(i) * p_pow) % m;
        p_pow = (p_pow * p) % m;
    }
    return hash;
}

function drawStep(step) {
    if (showChart && (step > chart.ptr || step == 0)) {
        if (step == 0) {
            chart.clear();
        }
        chart.ptr = step;
        chart.addData(chartLog[step]);
    }

    let [carLogs, tlLogs] = logs[step].split(';');

    tlLogs = tlLogs.split(',');
    carLogs = carLogs.split(',');
    
    let tlLog, tlEdge, tlStatus;
    for (let i = 0, len = tlLogs.length;i < len;++i) {
        tlLog = tlLogs[i].split(' ');
        tlEdge = tlLog[0];
        tlStatus = tlLog.slice(1);
        for (let j = 0, len = tlStatus.length;j < len;++j) {
            trafficLightsG[tlEdge][j].tint = _statusToColor(tlStatus[j]);
            if (tlStatus[j] == 'i' ) {
                trafficLightsG[tlEdge][j].alpha = 0;
            }else{
                trafficLightsG[tlEdge][j].alpha = 1;
            }
        }
    }

    carContainer.removeChildren();
    turnSignalContainer.removeChildren();
    let carLog, position, length, width;
    let poolIdx = 0;   // separate pool pointer so density-skipped slots are reused
    for (let i = 0, len = carLogs.length - 1;i < len;++i) {
        carLog = carLogs[i].split(' ');

        // ── Vehicle Density filter ──────────────────────────────────────────
        // Use a deterministic hash of the vehicle ID so the same vehicles are
        // always shown/hidden regardless of the current step.
        if (VEHICLE_DENSITY < 1.0 &&
            (stringHash(carLog[3]) % 1000) / 1000 >= VEHICLE_DENSITY) continue;

        position = transCoord([parseFloat(carLog[0]), parseFloat(carLog[1])]);
        length = parseFloat(carLog[5]);
        width  = parseFloat(carLog[6]);

        // ── Lane-width scale: shift car perpendicular to road ───────────────
        let pixiRot = 2*Math.PI - parseFloat(carLog[2]);
        let scaledPos = scaledCarPos(position[0], position[1], pixiRot);

        carPool[poolIdx][0].position.set(scaledPos[0], scaledPos[1]);
        carPool[poolIdx][0].rotation = pixiRot;
        carPool[poolIdx][0].name = carLog[3];
        let carColorId = stringHash(carLog[3]) % CAR_COLORS_NUM;
        carPool[poolIdx][0].tint = CAR_COLORS[carColorId];
        carPool[poolIdx][0].width  = CAR_SIZE_OVERRIDE ? CAR_LENGTH_CUSTOM : length;
        carPool[poolIdx][0].height = CAR_SIZE_OVERRIDE ? CAR_WIDTH_CUSTOM  : width;
        carContainer.addChild(carPool[poolIdx][0]);

        let laneChange = parseInt(carLog[4]) + 1;
        carPool[poolIdx][1].position.set(scaledPos[0], scaledPos[1]);
        carPool[poolIdx][1].rotation = pixiRot;
        carPool[poolIdx][1].texture = turnSignalTextures[laneChange];
        carPool[poolIdx][1].width  = CAR_SIZE_OVERRIDE ? CAR_LENGTH_CUSTOM : length;
        carPool[poolIdx][1].height = CAR_SIZE_OVERRIDE ? CAR_WIDTH_CUSTOM  : width;
        turnSignalContainer.addChild(carPool[poolIdx][1]);

        poolIdx++;
    }
    nodeCarNum.innerText = poolIdx;   // show only rendered (post-filter) count
    nodeTotalStep.innerText = totalStep;
    nodeCurrentStep.innerText = cnt+1;
    nodeProgressPercentage.innerText = (cnt / totalStep * 100).toFixed(2) + "%";
    if (statsFile != "") {
        if (withRange) nodeRange.value = stats[step][1];
        nodeStats.innerText = stats[step][0].toFixed(2);
    }
}

/*
Chart
 */
let chart = {
    max_steps: 3600,
    data: {
        labels: [],
        series: [[]]
    },
    options: {
        showPoint: false,
        lineSmooth: false,
        axisX: {
            showGrid: false,
            showLabel: false
        }
    },
    init : function(title, series_cnt, max_step){
        document.getElementById("chart-title").innerText = title;
        this.max_steps = max_step;
        this.data.labels = new Array(this.max_steps);
        this.data.series = [];
        for (let i = 0 ; i < series_cnt ; ++i)
            this.data.series.push([]);
        this.chart = new Chartist.Line('#chart', this.data, this.options);
    },
    addData: function (value) {
        for (let i = 0 ; i < value.length; ++i) {
            this.data.series[i].push(value[i]);
            if (this.data.series[i].length > this.max_steps) {
                this.data.series[i].shift();
            }
        }
        this.chart.update();
    },
    clear: function() {
        for (let i = 0 ; i < this.data.series.length ; ++i)
            this.data.series[i] = [];
    },
    ptr: 0
};

/*
 * Settings Panel
 */
function hexToPixi(hex) {
    return parseInt(hex.replace('#', ''), 16);
}

function pixiToHex(color) {
    return '#' + color.toString(16).padStart(6, '0');
}

/**
 * Scale a car's perpendicular distance from its road reference line by
 * LANE_WIDTH_SCALE, so that cars stay inside their lanes when lane width
 * changes.  Uses the pre-built roadSegIndex to find the nearest matching
 * road segment (matched by direction angle).
 *
 * @param {number} rawX  - car X in screen coords (after transCoord)
 * @param {number} rawY  - car Y in screen coords
 * @param {number} pixiRot - car rotation in PixiJS radians (2π − simAngle)
 * @returns {[number, number]} scaled [x, y]
 */
function scaledCarPos(rawX, rawY, pixiRot) {
    if (LANE_WIDTH_SCALE === 1.0 || !window.roadSegIndex || window.roadSegIndex.length === 0)
        return [rawX, rawY];

    let cosA = Math.cos(pixiRot), sinA = Math.sin(pixiRot);

    // Find the best-matching road segment with NO bounds limit so segment lines
    // are extended through intersection nodes.  Score = |perp| / dot so that
    // cars with a good angle match AND small lateral offset win; dot is capped
    // at 0.1 to avoid division-by-zero on near-perpendicular segments.
    let best = null, bestScore = Infinity, bestPerp = 0, bestAlong = 0;

    for (let seg of window.roadSegIndex) {
        let dot = cosA * seg.ddx + sinA * seg.ddy;
        if (dot < 0.5) continue;            // skip opposite / perpendicular roads

        let rx    = rawX - seg.p1x, ry = rawY - seg.p1y;
        let along = rx * seg.ddx + ry * seg.ddy;
        let perp  = rx * seg.px  + ry * seg.py;

        // Must be within segment bounds (with margin for road-end zone)
        let margin = seg.len * 0.1 + 5;
        if (along < -margin || along > seg.len + margin) continue;

        // Reject if car is too far perpendicularly — likely a parallel road
        if (Math.abs(perp) > window.roadSegMaxWidth * 1.5) continue;

        let score = Math.abs(perp) / dot;
        if (score < bestScore) {
            bestScore = score;
            bestPerp  = perp;
            bestAlong = along;
            best      = seg;
        }
    }

    if (best) {
        return [
            best.p1x + bestAlong * best.ddx + bestPerp * LANE_WIDTH_SCALE * best.px,
            best.p1y + bestAlong * best.ddy + bestPerp * LANE_WIDTH_SCALE * best.py
        ];
    }

    // ── Intersection fallback: scale radially from nearest node centre ─────
    // The node polygon is also scaled from node.point, so this stays aligned.
    if (window.nodePositions && window.nodePositions.length > 0) {
        let nearest = null, nearestD2 = Infinity;
        for (let np of window.nodePositions) {
            let d2 = (rawX - np.x) * (rawX - np.x) + (rawY - np.y) * (rawY - np.y);
            if (d2 < nearestD2) { nearestD2 = d2; nearest = np; }
        }
        if (nearest) {
            return [
                nearest.x + (rawX - nearest.x) * LANE_WIDTH_SCALE,
                nearest.y + (rawY - nearest.y) * LANE_WIDTH_SCALE
            ];
        }
    }

    return [rawX, rawY];
}

function initSettings() {
    // --- Car Colors ---
    CAR_COLORS.forEach(function(color, i) {
        let picker = document.getElementById('car-color-' + i);
        if (!picker) return;
        picker.value = pixiToHex(color);
        picker.addEventListener('input', function() {
            CAR_COLORS[i] = hexToPixi(this.value);
        });
    });

    // --- Car Size Override ---
    let overrideCheckbox = document.getElementById('car-size-override');
    let sizeControls     = document.getElementById('car-size-controls');
    overrideCheckbox.addEventListener('change', function() {
        CAR_SIZE_OVERRIDE = this.checked;
        sizeControls.classList.toggle('d-none', !this.checked);
    });
    document.getElementById('car-length-input').addEventListener('input', function() {
        CAR_LENGTH_CUSTOM = parseFloat(this.value) || 5;
    });
    document.getElementById('car-width-input').addEventListener('input', function() {
        CAR_WIDTH_CUSTOM = parseFloat(this.value) || 2;
    });

    // --- Lane Width Scale ---
    let laneScaleSlider = document.getElementById('lane-width-scale');
    let laneScaleVal    = document.getElementById('lane-width-scale-val');
    laneScaleSlider.addEventListener('input', function() {
        LANE_WIDTH_SCALE = this.value / 100;
        laneScaleVal.innerText = LANE_WIDTH_SCALE.toFixed(2);
        if (ready) drawRoadnet();
    });

    // --- Vehicle Density ---
    let densitySlider = document.getElementById('vehicle-density');
    let densityVal    = document.getElementById('vehicle-density-val');
    densitySlider.addEventListener('input', function() {
        VEHICLE_DENSITY = this.value / 100;
        densityVal.innerText = this.value;
    });

    // --- Lane Divider Width (thickness) ---
    let dividerSlider = document.getElementById('lane-divider-width');
    let dividerVal    = document.getElementById('lane-divider-width-val');
    dividerSlider.addEventListener('input', function() {
        LANE_BORDER_WIDTH = parseInt(this.value);
        dividerVal.innerText = this.value;
    });

    // --- Lane Dash Length ---
    let dashSlider = document.getElementById('lane-dash-length');
    let dashVal    = document.getElementById('lane-dash-length-val');
    dashSlider.addEventListener('input', function() {
        LANE_DASH = parseInt(this.value);
        dashVal.innerText = this.value;
    });

    // --- Lane Dash Gap ---
    let gapSlider = document.getElementById('lane-dash-gap');
    let gapVal    = document.getElementById('lane-dash-gap-val');
    gapSlider.addEventListener('input', function() {
        LANE_GAP = parseInt(this.value);
        gapVal.innerText = this.value;
    });

    // --- Lane Divider Side Offset ---
    let insetSlider = document.getElementById('lane-divider-inset');
    let insetVal    = document.getElementById('lane-divider-inset-val');
    insetSlider.addEventListener('input', function() {
        LANE_DIVIDER_INSET = parseInt(this.value);
        insetVal.innerText = this.value;
    });

    // --- Background Color (instant) ---
    document.getElementById('bg-color').addEventListener('input', function() {
        BACKGROUND_COLOR = hexToPixi(this.value);
        if (app) app.renderer.backgroundColor = BACKGROUND_COLOR;
    });

    // --- Road & Lane Colors (need redraw via Apply button) ---
    document.getElementById('road-color').addEventListener('input', function() {
        LANE_COLOR = hexToPixi(this.value);
    });
    document.getElementById('lane-inner-color').addEventListener('input', function() {
        LANE_INNER_COLOR = hexToPixi(this.value);
    });

    // --- Apply Road Settings ---
    document.getElementById('apply-road-settings').addEventListener('click', function() {
        if (ready) {
            drawRoadnet();
            infoAppend("Road settings applied.");
        } else {
            infoAppend("Load a simulation first, then apply settings.");
        }
    });

    // --- Settings Collapse Toggle ---
    document.getElementById('settings-toggle').addEventListener('click', function() {
        let content  = document.getElementById('settings-content');
        let chevron  = document.getElementById('settings-chevron');
        let hidden   = content.classList.toggle('d-none');
        chevron.classList.toggle('fa-chevron-down', !hidden);
        chevron.classList.toggle('fa-chevron-up',    hidden);
    });
}

initSettings();
