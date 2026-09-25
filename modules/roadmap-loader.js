(function(){
  'use strict';
  let pending;
  function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(new Error('Roadmap konnte nicht geladen werden.'));};document.head.append(s);});}
  async function open(){
    const button=document.getElementById('roadmapToggleBtn');button.disabled=true;
    try{
      if(!pending)pending=(async()=>{let css=document.getElementById('roadmapStyles');if(!css){css=document.createElement('link');css.id='roadmapStyles';css.rel='stylesheet';css.href='modules/roadmap.css?v=330';await new Promise((resolve,reject)=>{css.onload=resolve;css.onerror=()=>{css.remove();reject(new Error('Roadmap-Design konnte nicht geladen werden.'));};document.head.append(css);});}if(!window.HabitFlowRoadmapDomain)await script('modules/roadmap-domain.js?v=330');if(!window.HabitFlowRoadmap)await script('modules/roadmap.js?v=330');})();
      await pending;window.HabitFlowRoadmap.open();
    }catch(error){pending=null;window.alert(error.message);}finally{button.disabled=false;}
  }
  document.getElementById('roadmapToggleBtn')?.addEventListener('click',open);
})();
