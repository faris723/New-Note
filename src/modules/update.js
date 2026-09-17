/**
 * In-App Update Checker — deterministic GitHub Release asset selection.
 * Only active inside the installed Capacitor APK.
 */
const GITHUB_OWNER = 'faris723';
const GITHUB_REPO = 'New-Note';
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const DISMISSED_KEY = 'cp_update_dismissed_version';

function parseVersion(v) { return String(v || '0').replace(/^v/i,'').split('.').map(n => parseInt(n,10)||0); }
function isNewer(remote, local) { const a=parseVersion(remote), b=parseVersion(local); for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x>y)return true;if(x<y)return false;} return false; }
function isRunningInsideApk(){ try{return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform==='function' && window.Capacitor.isNativePlatform());}catch{return false;} }
function findApk(release){
  const assets=Array.isArray(release?.assets)?release.assets:[];
  return assets.find(a=>a.name==='app-release.apk') || assets.find(a=>a.name==='app-debug.apk') || assets.find(a=>String(a.name||'').toLowerCase().endsWith('.apk')) || null;
}
function changelogUrl(current, remote){return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/compare/v${String(current).replace(/^v/i,'')}...v${String(remote).replace(/^v/i,'')}`;}

export const UpdateService = {
  currentVersion:'0.0.0', latestRelease:null,
  async init(elements={}, currentVersion){
    if(currentVersion)this.currentVersion=currentVersion;
    if(!isRunningInsideApk())return;
    const {updateModalOverlay,closeUpdateModalBtn,closeUpdateModalLaterBtn,updateModalBody,updateDownloadBtn,updateVersionText}=elements;
    try{
      const res=await fetch(`${RELEASES_API_URL}?_=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/vnd.github+json','Cache-Control':'no-cache'}});
      if(!res.ok)return;
      const release=await res.json();
      const remoteVersion=String(release.tag_name||'').replace(/^v/i,'');
      if(!remoteVersion || !isNewer(remoteVersion,this.currentVersion))return;
      if(localStorage.getItem(DISMISSED_KEY)===remoteVersion)return;
      const asset=findApk(release);
      if(!asset?.browser_download_url){console.warn('UpdateService: release tidak memiliki APK.');return;}
      this.latestRelease={release,asset};
      if(updateVersionText)updateVersionText.textContent=`Versi ${remoteVersion} tersedia (versi Anda saat ini: ${this.currentVersion})`;
      if(updateModalBody){const notes=String(release.body||'').replace(/https?:\/\/github\.com\/faris723\/New-Note\/compare\/[^\s)]+/g,'').trim();updateModalBody.textContent=(notes?notes+'\n\n':'')+'Full Changelog: '+changelogUrl(this.currentVersion,remoteVersion);}
      if(updateDownloadBtn)updateDownloadBtn.onclick=()=>window.open(asset.browser_download_url,'_blank');
      if(closeUpdateModalBtn)closeUpdateModalBtn.onclick=()=>updateModalOverlay?.classList.remove('open');
      if(closeUpdateModalLaterBtn)closeUpdateModalLaterBtn.onclick=()=>{localStorage.setItem(DISMISSED_KEY,remoteVersion);updateModalOverlay?.classList.remove('open');};
      updateModalOverlay?.classList.add('open');
    }catch(err){console.warn('UpdateService check notice:',err);}
  }
};
