(function() { 'use strict'; } )();

var Game = function (element, width, height, fps) {
  if (!element)
    element = document.body;
  if (!width)
    width = 640;
  if (!height)
    height = 360;
  if (!fps)
    fps = 60;
  this.CreateCanvas(element, width, height);
};

Game.prototype.CreateCanvas = function (element, width, height, fps) {
  console.debug("Creating canvas with size " + width + "x" + height);
  var canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  element.appendChild(canvas);
  this.Canvas = canvas;
  this.RenderContext = canvas.getContext('2d');
  if (!this.RenderContext) {
    throw 'Couldn\'t get canvas context! Check if your browser supports the HTML5 canvas!';
  }
  this.StartLoop(fps);
};

Game.prototype.StartLoop = function (fps) {
  this.PreferredFps = fps;
  this.PreviousTime = Date.now();
  this.Updateables = [];
  this.Renderables = [];
  this.StickyRenderables = [];
  this.Mouse =
  {
    DownAtX: 0,
    DownAtY: 0,
    MouseDown: false,
    MouseUpPending: false,
    MoveX: 0,
    MoveY: 0,
    UpAtX: 0,
    UpAtY: 0
  };
  this.RegisterEvents();
  var self = this;
  this.TimerHandle = setInterval(function() {
    self.GameLoop();
  }, 1000 / fps);
  this.Running = true;
};

Game.prototype.Stop = function() {
  if (!this.Running) {
    console.debug("Not running.");
    return;
  }
  clearInterval(this.TimerHandle);
  this.Running = false;
  console.debug("Stopped loop!");
};

Game.prototype.RegisterEvents = function() {
  var self = this;
  document.addEventListener("mousedown", function(e) {
    self.OnMouseDown(e);
  });
  document.addEventListener("mousemove", function(e) {
    self.OnMouseMove(e);
  });
  document.addEventListener("mouseup", function(e) {
    self.OnMouseUp(e);
  });
};

Game.prototype.OnMouseDown = function (e) {
  this.Mouse.DownAtX = e.clientX - this.Canvas.offsetLeft + document.documentElement.scrollLeft;
  this.Mouse.DownAtY = e.clientY - this.Canvas.offsetTop + document.documentElement.scrollTop;
  this.Mouse.MouseDown = true;
};

Game.prototype.OnMouseMove = function (e) {
  this.Mouse.MoveX = e.clientX - this.Canvas.offsetLeft + document.documentElement.scrollLeft;
  this.Mouse.MoveY = e.clientY - this.Canvas.offsetTop + document.documentElement.scrollTop;
};

Game.prototype.OnMouseUp = function (e) {
  this.Mouse.MouseDown = false;
  this.Mouse.MouseUpPending = true;
  this.Mouse.UpAtX = e.clientX - this.Canvas.offsetLeft + document.documentElement.scrollLeft;
  this.Mouse.UpAtY = e.clientY - this.Canvas.offsetTop + document.documentElement.scrollTop;
};

Game.prototype.GameLoop = function () {
  var currentTime = Date.now();
  var elapsed = currentTime - this.PreviousTime;
  this.Previoustime = currentTime;

  this.Update(elapsed);
  this.Render();
};

Game.prototype.Update = function (elapsed) {
  if (this.Mouse.MouseUpPending) {
    this.Mouse.MouseUpPending = false;
    var source = new Vector(this.Mouse.DownAtX, this.Mouse.DownAtY);
    var target = new Vector(this.Mouse.UpAtX, this.Mouse.UpAtY);
    var r = new Renderable(function (c, p) {
      p.moveTo(source.X, source.Y);
      p.lineTo(target.X, target.Y);
      c.strokeStyle = "#ff0000";
      c.stroke(p);
    });
    this.StickyRenderables.push(r);
  } // end MouseUpPending
  if (this.Mouse.MouseDown) {
    var sourceDown = new Vector(this.Mouse.DownAtX, this.Mouse.DownAtY);
    var targetDown = new Vector(this.Mouse.MoveX, this.Mouse.MoveY);
    var rDown = new Renderable(function (c, p) {
      p.moveTo(sourceDown.X, sourceDown.Y);
      p.lineTo(targetDown.X, targetDown.Y);
      c.strokeStyle = "#00ff00";
      c.stroke(p);
    });
    this.Renderables.push(rDown);
  } // end MouseDown

  for (var i = 0; i < this.Updateables.length; i++) {
    this.Updateables[i].Update(this, elapsed);
  }
};

Game.prototype.Render = function () {
  var c = this.RenderContext;
  var self = this;
  window.requestAnimationFrame(function () {
    c.fillStyle = "#121212";
    c.fillRect(0, 0, self.Canvas.width, self.Canvas.height);

    for (var i = 0; i < self.Renderables.length; i++) {
      self.Renderables[i].Render(c, new Path2D());
    }
    self.Renderables.length = 0;
    for (var j = 0; j < self.StickyRenderables.length; j++) {
      self.StickyRenderables[j].Render(c, new Path2D());
    }
  });
};

var Vector = function (x, y) {
  this.X = x;
  this.Y = y;
};

Vector.prototype.Add = function (other) {
  return new Vector(this.X + other.X, this.Y + other.Y);
};

Vector.prototype.Magnitude = function () {
  return this.DistanceTo(new Vector(0, 0));
};

Vector.prototype.DistanceTo = function (other) {
  return Math.sqrt(Math.pow(other.X - this.X, 2) + Math.pow(other.Y - this.Y , 2));
};

var Renderable = function(func) {
  this.Render = func;
};
