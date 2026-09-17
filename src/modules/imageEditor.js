/**
 * Lightweight image annotation editor.
 * Two canvas layers: original image + transparent annotations.
 */
const SHAPES = new Set(['line', 'rect', 'ellipse', 'arrow']);

export const ImageEditorService = {
  baseCanvas: null, drawCanvas: null, baseCtx: null, drawCtx: null,
  width: 0, height: 0, tool: 'pen', color: '#a3402f', size: 4,
  undoStack: [], redoStack: [], maxHistory: 25,

  init(baseCanvas, drawCanvas) {
    this.baseCanvas = baseCanvas;
    this.drawCanvas = drawCanvas;
    this.baseCtx = baseCanvas?.getContext('2d');
    this.drawCtx = drawCanvas?.getContext('2d');
    if (this.drawCanvas && !this._bound) {
      this._bind(); this._bound = true;
    }
  },

  loadImage(dataURL, maxWidth = 760, maxHeight = 560) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        this.width = Math.max(1, Math.round(img.width * scale));
        this.height = Math.max(1, Math.round(img.height * scale));
        for (const c of [this.baseCanvas, this.drawCanvas]) {
          c.width = this.width; c.height = this.height;
          c.style.width = `${this.width}px`; c.style.height = `${this.height}px`;
        }
        this.baseCtx.clearRect(0, 0, this.width, this.height);
        this.baseCtx.drawImage(img, 0, 0, this.width, this.height);
        this.drawCtx.clearRect(0, 0, this.width, this.height);
        this.undoStack = [this.drawCanvas.toDataURL()]; this.redoStack = [];
        resolve({width: this.width, height: this.height});
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar.'));
      img.src = dataURL;
    });
  },
  setTool(tool) { this.tool = tool; },
  setColor(color) { this.color = color; },
  setSize(size) { this.size = Math.max(1, Number(size) || 4); },
  _save() {
    const s = this.drawCanvas.toDataURL();
    if (this.undoStack.length >= this.maxHistory) this.undoStack.shift();
    this.undoStack.push(s); this.redoStack = [];
  },
  _restore(data) {
    const img = new Image();
    img.onload = () => { this.drawCtx.clearRect(0,0,this.width,this.height); this.drawCtx.drawImage(img,0,0,this.width,this.height); };
    img.src = data;
  },
  undo() {
    if (this.undoStack.length <= 1) return;
    this.redoStack.push(this.undoStack.pop()); this._restore(this.undoStack[this.undoStack.length-1]);
  },
  redo() {
    if (!this.redoStack.length) return;
    const next = this.redoStack.pop(); this.undoStack.push(next); this._restore(next);
  },
  clear() { this.drawCtx.clearRect(0,0,this.width,this.height); this._save(); },
  _coords(e) {
    const r=this.drawCanvas.getBoundingClientRect();
    return {x:(e.clientX-r.left)*(this.width/r.width), y:(e.clientY-r.top)*(this.height/r.height)};
  },
  _shape(tool,x1,y1,x2,y2) {
    const c=this.drawCtx; c.strokeStyle=this.color; c.fillStyle=this.color; c.lineWidth=this.size; c.lineCap='round'; c.lineJoin='round'; c.beginPath();
    if(tool==='line'){c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
    else if(tool==='rect'){c.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));}
    else if(tool==='ellipse'){c.ellipse((x1+x2)/2,(y1+y2)/2,Math.max(.5,Math.abs(x2-x1)/2),Math.max(.5,Math.abs(y2-y1)/2),0,0,Math.PI*2);c.stroke();}
    else if(tool==='arrow'){
      const a=Math.atan2(y2-y1,x2-x1), h=10+this.size*1.5; c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
      c.beginPath(); c.moveTo(x2,y2); c.lineTo(x2-h*Math.cos(a-Math.PI/6),y2-h*Math.sin(a-Math.PI/6)); c.lineTo(x2-h*Math.cos(a+Math.PI/6),y2-h*Math.sin(a+Math.PI/6)); c.closePath(); c.fill();
    }
  },
  addText(x,y,text){ if(!text)return; this.drawCtx.fillStyle=this.color; this.drawCtx.font=`${Math.max(12,this.size*5)}px sans-serif`; this.drawCtx.fillText(text,x,y); this._save(); },
  _bind(){
    let down=false,sx=0,sy=0,lastX=0,lastY=0,snapshot=null;
    const start=e=>{ if(this.tool==='text')return; e.preventDefault(); down=true; const p=this._coords(e); sx=lastX=p.x; sy=lastY=p.y; if(SHAPES.has(this.tool)) snapshot=this.drawCanvas.toDataURL(); };
    const move=e=>{ if(!down)return; e.preventDefault(); const p=this._coords(e); const c=this.drawCtx;
      if(this.tool==='pen'||this.tool==='eraser'){c.beginPath();c.moveTo(lastX,lastY);c.lineTo(p.x,p.y);c.lineCap='round';c.lineJoin='round';c.lineWidth=this.tool==='eraser'?this.size*3.5:this.size;c.strokeStyle=this.color;c.globalCompositeOperation=this.tool==='eraser'?'destination-out':'source-over';c.stroke();c.globalCompositeOperation='source-over';lastX=p.x;lastY=p.y;}
      else if(SHAPES.has(this.tool)&&snapshot){const img=new Image();img.onload=()=>{if(!down)return;c.clearRect(0,0,this.width,this.height);c.drawImage(img,0,0,this.width,this.height);this._shape(this.tool,sx,sy,p.x,p.y);};img.src=snapshot;}
    };
    const stop=()=>{if(!down)return;down=false;snapshot=null;this._save();};
    for(const ev of ['pointerdown','pointermove','pointerup','pointercancel','pointerleave']) this.drawCanvas.addEventListener(ev,ev==='pointerdown'?start:ev==='pointermove'?move:stop);
  },
  exportFlattened(mime='image/png',quality=.9){const out=document.createElement('canvas');out.width=this.width;out.height=this.height;const c=out.getContext('2d');c.drawImage(this.baseCanvas,0,0);c.drawImage(this.drawCanvas,0,0);return out.toDataURL(mime,quality);}
};
