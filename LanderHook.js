if (LanderHook) {
  LanderHook.stopTimer();
}

var ChangeObserver = function(element, cllback) {
  this.observedElement = element;
  this.lastText = element.innerText || element.innerContent;
  var self = this;
  this.callback = function() {
    var txt = self.observedElement.innerText || self.observedElement.textContent;
    if (txt !== self.lastText) {
      self.lastText = txt;
      cllback(txt);
    }
  }; // this.callback
}; // ChangeObserver

ChangeObserver.prototype.start = function(interval) {
  this.timerHandle = setInterval(this.callback, interval);
};

ChangeObserver.prototype.stop = function() {
  clearInterval(this.timerHandle);
};


var Renderer = {
  canvas: { },
  context: { },
  degToRad: Math.PI / 180,
  vectorLineLength: 300,
  virtualWidth: 7000,
  virtualHeight: 3000,
  
  init: function(canvas) {
    Renderer.canvas = canvas;
    Renderer.context = Renderer.canvas.getContext('2d');
    console.info('[Renderer] Initialized.');
  },
  
  drawGhosts: function(frameNumber, frameList) {
    window.requestAnimationFrame(function() {
      var frameNum = frameNumber;
      var list = frameList;
      var c = Renderer.context;
      c.strokeStyle = "#222222"
      for (var i = 0; i < frameNum; i++) {
        c.moveTo(list[i].x, list[i].y);
        c.beginPath();
        var radius = Math.abs(list[i].hspeed) + Math.abs(list[i].vspeed);
        radius /= 3;
        c.arc(list[i].x, Renderer.virtualHeight - list[i].y, radius, 0, Math.PI * 2, false);
        c.closePath();
        c.stroke();
      }
    });
  },
  
  drawLanderVector: function(frame) {
    var yactuall = Renderer.virtualHeight - frame.y; // canvas Y and game Y are inverse
    var radAngle = frame.angle * Renderer.degToRad;
    radAngle = -radAngle;
    
    var leftyy = yactuall + Renderer.vectorLineLength * Math.sin(radAngle);
    var leftxx = frame.x + Renderer.vectorLineLength * Math.cos(radAngle);
    
    var topyy = yactuall + Renderer.vectorLineLength * Math.sin(radAngle - (Math.PI / 2));
    var topxx = frame.x + Renderer.vectorLineLength * Math.cos(radAngle - (Math.PI / 2));
    
    var nextFramePosYY = yactuall - frame.vspeed;
    var nextFramePosXX = frame.x + frame.hspeed;

    window.requestAnimationFrame(function() {
      var yactual = yactuall,      
          lefty = leftyy,
          leftx = leftxx,
          topy = topyy,
          topx = topxx,
          nextFramePosY = nextFramePosYY,
          nextFramePosX = nextFramePosXX,
          framex = frame.x;
      var path = new Path2D();
      path.moveTo(leftx, lefty); // start path from left line
      path.lineTo(framex, yactual); // line to ship's coords
      path.lineTo(topx, topy); // line to top
      Renderer.context.strokeStyle = "#ff0000";
      Renderer.context.stroke(path);
      var nextFramePos = new Path2D();
      nextFramePos.moveTo(framex, yactual);
      nextFramePos.lineTo(nextFramePosX, nextFramePosY);
      Renderer.context.strokeStyle = "#00ff00";
      Renderer.context.stroke(nextFramePos);
    });
  },
  
  drawTarget: function(frame) {
    window.requestAnimationFrame(function() {
      var c = Renderer.context;
      c.strokeStyle = "#ffff00";
      c.beginPath();
      c.arc(frame.targetx, Renderer.virtualHeight - frame.targety, 100, 0, Math.PI * 2, false);
      c.stroke();
      c.closePath();
    });
  },
  
  writeLabels: function() {
    window.requestAnimationFrame(function () {
      var c = Renderer.context;
      c.fillStyle = "#ffffff";

      c.fillText("AXIS MARKER", 700, 900);
      var markerPath = new Path2D();
      markerPath.moveTo(1350, 900);
      markerPath.lineTo(1350 + 75, 900);
      markerPath.lineTo(1350 + 75, 900 - 75);
      c.strokeStyle = "#ff0000";
      c.stroke(markerPath);

      c.fillText("ESTIMATION", 700, 1050);
      var estimation = new Path2D();
      estimation.moveTo(1350, 1050 - 33);
      estimation.lineTo(1350 + 75, 1050 - 33);
      c.strokeStyle = "#00ff00";
      c.stroke(estimation);
      
      c.fillText("PREV POSITION", 700, 1200);
      var ghost = new Path2D();
      ghost.arc(1350 + 75 / 2, 1200 - 33, 50, 0, Math.PI * 2, false);
      c.strokeStyle = "#222222";
      c.stroke(ghost);
    });
  }
};

/*var attributes = {
  x: lineTwo[0].match(LanderHook.numberRegex) [0],
  y: lineTwo[1].match(LanderHook.numberRegex) [0],
  hspeed: lineTwo[2].match(LanderHook.numberRegex) [0],
  vspeed: lineTwo[3].match(LanderHook.numberRegex) [0],
  fuel: lineThree[0].match(LanderHook.numberRegex) [0],
  angle: lineThree[1].match(LanderHook.numberRegex) [0],
  power: lineThree[2].match(LanderHook.numberRegex) [0],
  velocity: lineThree[3].match(LanderHook.velocityRegex) [0]
};*/

var LanderHook = {
  canvas: { }, // game canvas
  consoleErrorElements: [ ],
  consoleInfoElements: [ ], // array containing each frame's console info
  doc: { }, // game iframe document
  frames: [ ], // individual frames' attributes populated by getFrameInfos
  initialized: false,
  numberRegex: new RegExp('-?\\d+'),
  observer: { },
  velocityRegex: new RegExp('\\d+\\.\\d+'),
  
  init: function(force) {
    if (!force && LanderHook.initialized) {
      console.error('[LanderHook] Already initialized. Pass \'true\' to reinitialize.');
      return;
    }
    LanderHook.doc = document.getElementById('ideFrame').contentDocument;
    LanderHook.canvas = LanderHook.doc.querySelector('canvas');
    LanderHook.consoleErrorElements = LanderHook.doc.getElementsByClassName('consoleError');
    LanderHook.consoleInfoElements = LanderHook.doc.getElementsByClassName('consoleInfos');
    LanderHook.observer = new ChangeObserver(
      LanderHook.doc.querySelector('.frame_count.frame_timer_text'),
      LanderHook.onChangeObserved
    );
    LanderHook.initialized = true;
    console.info('[LanderHook] Initialized.');
  },
  
  findTargetNode: function(errorNode) {
    if (errorNode) {
      for (var i = 0; i < errorNode.childNodes.length; i++) {
        var text = errorNode.childNodes[i].innerText ||
                   errorNode.childNodes[i].textContent;
        if (text.contains("TARGET"))
          return text;
      }
    }
    return "TARGET:2250,2250";
  },
  
  getFrameInfos: function() {
    LanderHook.frames = [];
    for (var i = 0; i < LanderHook.consoleInfoElements.length; i++) {
      var textContent = LanderHook.consoleInfoElements[i].innerText ||
                        LanderHook.consoleInfoElements[i].textContent;
      var errorContent = LanderHook.findTargetNode(LanderHook.consoleErrorElements[i]);
      textContent = textContent.split('\n');
      var lineTwo = textContent[1].split(' ');
      var lineThree = textContent[2].split(' ');
      var errorPair = errorContent.split(':')[1].split(',');
      var attributes = {
        x: parseInt(lineTwo[0].match(LanderHook.numberRegex)[0]),
        y: parseInt(lineTwo[1].match(LanderHook.numberRegex)[0]),
        hspeed: parseInt(lineTwo[2].match(LanderHook.numberRegex)[0]),
        vspeed: parseInt(lineTwo[3].match(LanderHook.numberRegex)[0]),
        fuel: parseInt(lineThree[0].match(LanderHook.numberRegex)[0]),
        angle: parseInt(lineThree[1].match(LanderHook.numberRegex)[0]),
        power: parseInt(lineThree[2].match(LanderHook.numberRegex)[0]),
        velocity: parseInt(lineThree[3].match(LanderHook.velocityRegex)[0]),
        targetx: parseInt(errorPair[0]),
        targety: parseInt(errorPair[1])
      };
      LanderHook.frames.push(attributes);
    }
    // end for loop
    console.info('[LanderHook] Parsed ' + LanderHook.frames.length + ' frames.');
  },
  
  onChangeObserved: function(text) {
    var split = text.split('/');
    var currFrame = parseInt(split[0]);
    if (parseInt(split[1]) !== LanderHook.frames.length) {
      LanderHook.getFrameInfos(); // New frames!
    }
    Renderer.writeLabels();
    Renderer.drawGhosts(currFrame, LanderHook.frames);
    Renderer.drawLanderVector(LanderHook.frames[currFrame - 1]);
    Renderer.drawTarget(LanderHook.frames[currFrame - 1]);
  },
  
  startTimer: function(interval) {
    LanderHook.observer.start(interval);
  },
  
  stopTimer: function() {
    LanderHook.observer.stop();
  }
};


LanderHook.init();
LanderHook.getFrameInfos();
Renderer.init(LanderHook.canvas);
LanderHook.startTimer(33);