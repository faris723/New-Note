/**
 * Lightweight image annotation editor.
 * Three layers: original image, raster drawings, and movable text annotations.
 * Text remains a real annotation object until export, so it can be dragged.
 */
const SHAPES = new Set(['line', 'rect', 'ellipse', 'arrow']);

function cloneTexts(items = []) {
  return items.map((item) => ({ ...item }));
}

export const ImageEditorService = {
  baseCanvas: null, drawCanvas: null, textCanvas: null,
  baseCtx: null, drawCtx: null, textCtx: null,
  width: 0, height: 0, tool: 'pen', color: '#a3402f', size: 4,
  undoStack: [], redoStack: [], maxHistory: 25,
  textAnnotations: [], draggingText: null, _bound: false,

  init(baseCanvas, drawCanvas, textCanvas = null) {
    this.baseCanvas = baseCanvas;
    this.drawCanvas = drawCanvas;
    this.textCanvas = textCanvas;
    this.baseCtx = baseCanvas?.getContext('2d');
    this.drawCtx = drawCanvas?.getContext('2d');
    this.textCtx = textCanvas?.getContext('2d');
    if (this.drawCanvas && !this._bound) {
      this._bind();
      this._bound = true;
    }
    this._syncTextPointerEvents();
  },

  loadImage(dataURL, maxWidth = 760, maxHeight = 560) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        this.width = Math.max(1, Math.round(img.width * scale));
        this.height = Math.max(1, Math.round(img.height * scale));
        for (const c of [this.baseCanvas, this.drawCanvas, this.textCanvas].filter(Boolean)) {
          c.width = this.width;
          c.height = this.height;
          c.style.width = `${this.width}px`;
          c.style.height = `${this.height}px`;
        }
        this.baseCtx.clearRect(0, 0, this.width, this.height);
        this.baseCtx.drawImage(img, 0, 0, this.width, this.height);
        this.drawCtx.clearRect(0, 0, this.width, this.height);
        this.textAnnotations = [];
        this.renderTexts();
        this.undoStack = [this._captureState()];
        this.redoStack = [];
        resolve({ width: this.width, height: this.height });
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar.'));
      img.src = dataURL;
    });
  },

  setTool(tool) {
    this.tool = tool;
    this._syncTextPointerEvents();
  },
  setColor(color) { this.color = color; this.renderTexts(); },
  setSize(size) { this.size = Math.max(1, Number(size) || 4); },

  _syncTextPointerEvents() {
    if (this.textCanvas) {
      this.textCanvas.style.pointerEvents = this.tool === 'text' ? 'auto' : 'none';
      this.textCanvas.style.cursor = this.tool === 'text' ? 'grab' : 'default';
    }
  },

  _captureState() {
    return {
      draw: this.drawCanvas?.toDataURL() || '',
      texts: cloneTexts(this.textAnnotations)
    };
  },

  _save() {
    const state = this._captureState();
    if (this.undoStack.length >= this.maxHistory) this.undoStack.shift();
    this.undoStack.push(state);
    this.redoStack = [];
  },

  _restore(state) {
    const normalized = typeof state === 'string' ? { draw: state, texts: [] } : (state || { draw: '', texts: [] });
    this.textAnnotations = cloneTexts(normalized.texts || []);
    const img = new Image();
    img.onload = () => {
      this.drawCtx.clearRect(0, 0, this.width, this.height);
      if (normalized.draw) this.drawCtx.drawImage(img, 0, 0, this.width, this.height);
      this.renderTexts();
    };
    img.src = normalized.draw || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  },

  undo() {
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(this.undoStack.pop());
    this._restore(this.undoStack[this.undoStack.length - 1]);
  },

  redo() {
    if (!this.redoStack.length) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this._restore(next);
  },

  clear() {
    this.drawCtx.clearRect(0, 0, this.width, this.height);
    this.textAnnotations = [];
    this.renderTexts();
    this._save();
  },

  _coords(e, canvas = this.drawCanvas) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (this.width / r.width),
      y: (e.clientY - r.top) * (this.height / r.height)
    };
  },

  _shape(tool, x1, y1, x2, y2) {
    const c = this.drawCtx;
    c.strokeStyle = this.color;
    c.fillStyle = this.color;
    c.lineWidth = this.size;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    if (tool === 'line') { c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    else if (tool === 'rect') c.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    else if (tool === 'ellipse') {
      c.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.max(.5, Math.abs(x2 - x1) / 2), Math.max(.5, Math.abs(y2 - y1) / 2), 0, 0, Math.PI * 2);
      c.stroke();
    } else if (tool === 'arrow') {
      const a = Math.atan2(y2 - y1, x2 - x1), h = 10 + this.size * 1.5;
      c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.beginPath();
      c.moveTo(x2, y2);
      c.lineTo(x2 - h * Math.cos(a - Math.PI / 6), y2 - h * Math.sin(a - Math.PI / 6));
      c.lineTo(x2 - h * Math.cos(a + Math.PI / 6), y2 - h * Math.sin(a + Math.PI / 6));
      c.closePath(); c.fill();
    }
  },

  _textFont(item) {
    return `${Math.max(12, Number(item.size || this.size) * 5)}px sans-serif`;
  },

  renderTexts(selectedId = null) {
    if (!this.textCtx || !this.textCanvas) return;
    const c = this.textCtx;
    c.clearRect(0, 0, this.width, this.height);
    for (const item of this.textAnnotations) {
      c.save();
      c.font = this._textFont(item);
      c.fillStyle = item.color || this.color;
      c.textBaseline = 'alphabetic';
      c.fillText(item.text, item.x, item.y);
      if (item.id === selectedId) {
        const width = c.measureText(item.text).width;
        const fontSize = Math.max(12, Number(item.size || this.size) * 5);
        c.strokeStyle = item.color || this.color;
        c.lineWidth = 1;
        c.setLineDash([4, 3]);
        c.strokeRect(item.x - 4, item.y - fontSize - 4, width + 8, fontSize + 8);
      }
      c.restore();
    }
  },

  _hitText(x, y) {
    if (!this.textCtx) return null;
    for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
      const item = this.textAnnotations[i];
      this.textCtx.font = this._textFont(item);
      const width = this.textCtx.measureText(item.text).width;
      const fontSize = Math.max(12, Number(item.size || this.size) * 5);
      if (x >= item.x - 8 && x <= item.x + width + 8 && y >= item.y - fontSize - 8 && y <= item.y + 8) return item;
    }
    return null;
  },

  addText(x, y, text) {
    const clean = String(text || '').trim();
    if (!clean) return null;
    const item = {
      id: `txt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      x: Math.max(4, Math.min(this.width - 4, Number(x) || 20)),
      y: Math.max(16, Math.min(this.height - 4, Number(y) || 30)),
      text: clean,
      color: this.color,
      size: this.size
    };
    this.textAnnotations.push(item);
    this.renderTexts(item.id);
    this._save();
    return item;
  },

  _bind() {
    let down = false, sx = 0, sy = 0, lastX = 0, lastY = 0, snapshot = null;

    const start = (e) => {
      if (this.tool === 'text') return;
      e.preventDefault();
      down = true;
      const p = this._coords(e);
      sx = lastX = p.x; sy = lastY = p.y;
      if (SHAPES.has(this.tool)) snapshot = this.drawCanvas.toDataURL();
    };

    const move = (e) => {
      if (!down) return;
      e.preventDefault();
      const p = this._coords(e);
      const c = this.drawCtx;
      if (this.tool === 'pen' || this.tool === 'eraser') {
        c.beginPath(); c.moveTo(lastX, lastY); c.lineTo(p.x, p.y);
        c.lineCap = 'round'; c.lineJoin = 'round';
        c.lineWidth = this.tool === 'eraser' ? this.size * 3.5 : this.size;
        c.strokeStyle = this.color;
        c.globalCompositeOperation = this.tool === 'eraser' ? 'destination-out' : 'source-over';
        c.stroke(); c.globalCompositeOperation = 'source-over';
        lastX = p.x; lastY = p.y;
      } else if (SHAPES.has(this.tool) && snapshot) {
        const img = new Image();
        img.onload = () => {
          if (!down) return;
          c.clearRect(0, 0, this.width, this.height);
          c.drawImage(img, 0, 0, this.width, this.height);
          this._shape(this.tool, sx, sy, p.x, p.y);
        };
        img.src = snapshot;
      }
    };

    const stop = () => {
      if (!down) return;
      down = false; snapshot = null; this._save();
    };

    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave']) {
      this.drawCanvas.addEventListener(ev, ev === 'pointerdown' ? start : ev === 'pointermove' ? move : stop);
    }

    if (this.textCanvas) {
      let dragging = false, dragged = null, offsetX = 0, offsetY = 0;
      const textStart = (e) => {
        if (this.tool !== 'text') return;
        e.preventDefault();
        const p = this._coords(e, this.textCanvas);
        const item = this._hitText(p.x, p.y);
        if (!item) return;
        dragged = item;
        dragging = true;
        offsetX = p.x - item.x;
        offsetY = p.y - item.y;
        this.draggingText = item;
        this.renderTexts(item.id);
        try { this.textCanvas.setPointerCapture(e.pointerId); } catch (_) {}
      };
      const textMove = (e) => {
        if (!dragging || !dragged) return;
        e.preventDefault();
        const p = this._coords(e, this.textCanvas);
        dragged.x = Math.max(4, Math.min(this.width - 4, p.x - offsetX));
        dragged.y = Math.max(16, Math.min(this.height - 4, p.y - offsetY));
        this.renderTexts(dragged.id);
      };
      const textStop = () => {
        if (!dragging) return;
        dragging = false;
        dragged = null;
        this.draggingText = null;
        this._save();
      };
      this.textCanvas.addEventListener('pointerdown', textStart);
      this.textCanvas.addEventListener('pointermove', textMove);
      this.textCanvas.addEventListener('pointerup', textStop);
      this.textCanvas.addEventListener('pointercancel', textStop);
    }
  },

  exportFlattened(mime = 'image/png', quality = .9) {
    const out = document.createElement('canvas');
    out.width = this.width; out.height = this.height;
    const c = out.getContext('2d');
    c.drawImage(this.baseCanvas, 0, 0);
    c.drawImage(this.drawCanvas, 0, 0);
    if (this.textCanvas) c.drawImage(this.textCanvas, 0, 0);
    return out.toDataURL(mime, quality);
  }
};
