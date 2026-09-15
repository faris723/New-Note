/**
 * Canvas Sketch Mode Service
 * Offline hand-drawn sketch and diagramming engine using HTML5 Canvas.
 * Supports smooth strokes, pen/brush/eraser tools, undo/redo stacks, and image export.
 */

export const SketchService = {
  canvas: null,
  ctx: null,
  isDrawing: false,
  tool: 'pen', // 'pen', 'brush', 'eraser'
  color: '#2b2a24',
  size: 3,
  bgColor: '#faf7ef',
  undoStack: [],
  redoStack: [],
  maxHistory: 25,
  lastX: 0,
  lastY: 0,

  init(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.setupListeners();
  },

  resizeCanvas(containerEl) {
    if (!this.canvas || !containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const width = Math.max(300, Math.floor(rect.width) - 24);
    const height = Math.max(280, Math.floor(rect.height) - 24);

    // Save current drawing if any
    let currentDrawing = null;
    if (this.canvas.width > 0 && this.canvas.height > 0) {
      try {
        currentDrawing = this.canvas.toDataURL();
      } catch (e) {}
    }

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (currentDrawing) {
      const img = new Image();
      img.onload = () => {
        this.clearBackground();
        this.ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = currentDrawing;
    } else {
      this.clearBackground();
      this.saveState();
    }
  },

  clearBackground() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bgColor === 'transparent') {
      this.ctx.clearRect(0, 0, w, h);
    } else {
      this.ctx.fillStyle = this.bgColor;
      this.ctx.fillRect(0, 0, w, h);
    }
    this.ctx.restore();
  },

  saveState() {
    try {
      if (this.undoStack.length >= this.maxHistory) {
        this.undoStack.shift();
      }
      this.undoStack.push(this.canvas.toDataURL());
      this.redoStack = [];
    } catch (e) {
      console.warn('Sketch history save error:', e);
    }
  },

  undo() {
    if (this.undoStack.length <= 1) return;
    const current = this.undoStack.pop();
    this.redoStack.push(current);
    const prevDataUrl = this.undoStack[this.undoStack.length - 1];
    this.restoreDataUrl(prevDataUrl);
  },

  redo() {
    if (this.redoStack.length === 0) return;
    const nextDataUrl = this.redoStack.pop();
    this.undoStack.push(nextDataUrl);
    this.restoreDataUrl(nextDataUrl);
  },

  restoreDataUrl(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.clearBackground();
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = dataUrl;
  },

  clearAll() {
    this.clearBackground();
    this.saveState();
  },

  setTool(tool) {
    this.tool = tool;
  },

  setColor(hex) {
    this.color = hex;
  },

  setSize(size) {
    this.size = Number(size) || 3;
  },

  setBackground(bg) {
    this.bgColor = bg;
    this.clearBackground();
    this.saveState();
  },

  getCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  },

  setupListeners() {
    const startDraw = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const { x, y } = this.getCoordinates(e);
      this.lastX = x;
      this.lastY = y;

      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const { x, y } = this.getCoordinates(e);

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(x, y);

      if (this.tool === 'eraser') {
        if (this.bgColor === 'transparent') {
          this.ctx.globalCompositeOperation = 'destination-out';
          this.ctx.lineWidth = this.size * 3.5;
        } else {
          this.ctx.globalCompositeOperation = 'source-over';
          this.ctx.strokeStyle = this.bgColor;
          this.ctx.lineWidth = this.size * 3.5;
        }
      } else if (this.tool === 'brush') {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.size * 2.5;
        this.ctx.globalAlpha = 0.45;
      } else {
        // Pen
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.color;
        this.ctx.lineWidth = this.size;
        this.ctx.globalAlpha = 1.0;
      }

      this.ctx.stroke();
      this.ctx.globalAlpha = 1.0;
      this.ctx.globalCompositeOperation = 'source-over';

      this.lastX = x;
      this.lastY = y;
    };

    const stopDraw = (e) => {
      if (this.isDrawing) {
        this.isDrawing = false;
        this.saveState();
      }
    };

    this.canvas.addEventListener('pointerdown', startDraw);
    this.canvas.addEventListener('pointermove', draw);
    this.canvas.addEventListener('pointerup', stopDraw);
    this.canvas.addEventListener('pointercancel', stopDraw);
    this.canvas.addEventListener('pointerleave', stopDraw);
  },

  /**
   * Export canvas drawing as an attachment object.
   */
  exportToAttachment() {
    const dataURL = this.canvas.toDataURL('image/png', 0.85);
    const approxSize = Math.round((dataURL.length - 22) * 0.75);
    const now = new Date();
    const timeCode = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0');

    return {
      id: 'sketch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: `sketsa_${timeCode}.png`,
      mime: 'image/png',
      ext: 'png',
      size: approxSize,
      dataURL,
      kind: 'sketch',
      createdAt: Date.now()
    };
  }
};
