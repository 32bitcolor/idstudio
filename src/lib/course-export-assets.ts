// Static assets for an exported course package. These are framework-free so the
// package runs standalone inside any LMS iframe. player.js renders window.COURSE
// and talks to the LMS through the window.LMS abstraction, which is implemented by
// scorm.js (SCORM 1.2 + 2004) or xapi.js (xAPI / Tin Can) depending on the format.

export const STYLES = `
:root { --fg:#1f2328; --muted:#5b6570; --border:#e3e6ea; --surface:#fff; --bg:#f6f8fa;
  --accent:#2563eb; --accent-fg:#fff; --ok:#16a34a; --bad:#dc2626; }
* { box-sizing:border-box; }
body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  color:var(--fg); background:var(--bg); line-height:1.6; }
.wrap { display:flex; min-height:100vh; }
.nav { width:260px; flex-shrink:0; background:var(--surface); border-right:1px solid var(--border);
  padding:20px 12px; position:sticky; top:0; height:100vh; overflow:auto; }
.nav h1 { font-size:15px; margin:0 8px 16px; }
.nav a { display:block; padding:8px 10px; border-radius:8px; color:var(--muted); text-decoration:none;
  font-size:14px; cursor:pointer; }
.nav a.on { background:#eef2ff; color:var(--fg); font-weight:600; }
.nav a .n { color:#9aa4b0; margin-right:6px; }
.main { flex:1; display:flex; justify-content:center; padding:40px 24px 80px; }
.lesson { max-width:680px; width:100%; }
.lesson > h2.title { font-size:28px; font-weight:700; margin:0 0 24px; }
.blk-heading { margin:28px 0 8px; font-weight:600; }
h1.blk-heading{font-size:26px} h2.blk-heading{font-size:22px} h3.blk-heading{font-size:18px}
.blk-text { margin:12px 0; }
.blk-text ul,.blk-text ol { padding-left:22px; } .blk-text p { margin:8px 0; }
.blk-statement { border-left:3px solid var(--accent); padding:4px 0 4px 18px; font-size:20px;
  font-weight:500; margin:20px 0; }
.blk-image { margin:20px 0; } .blk-image img { max-width:100%; border-radius:10px; border:1px solid var(--border); }
.blk-image figcaption { text-align:center; color:var(--muted); font-size:14px; margin-top:8px; }
.blk-divider { border:none; border-top:1px solid var(--border); margin:24px 0; }
.acc { border:1px solid var(--border); border-radius:12px; overflow:hidden; margin:20px 0; background:var(--surface); }
.acc-item + .acc-item { border-top:1px solid var(--border); }
.acc-head { width:100%; text-align:left; background:none; border:none; padding:14px 16px; font-size:15px;
  font-weight:600; cursor:pointer; display:flex; justify-content:space-between; align-items:center; color:var(--fg); }
.acc-head:hover { background:var(--bg); }
.acc-body { padding:0 16px 16px; white-space:pre-wrap; display:none; }
.acc-item.open .acc-body { display:block; }
.acc-item.open .acc-head .car { transform:rotate(180deg); }
.kc { border:1px solid var(--border); border-radius:12px; padding:20px; margin:24px 0; background:var(--surface); }
.kc-q { font-weight:600; margin:0 0 12px; }
.kc-opt { display:block; width:100%; text-align:left; background:var(--surface); border:1px solid var(--border);
  border-radius:10px; padding:10px 14px; margin:8px 0; font-size:15px; cursor:pointer; color:var(--fg); }
.kc-opt:hover:not(:disabled) { background:var(--bg); }
.kc-opt.correct { border-color:var(--ok); background:rgba(22,163,74,.08); }
.kc-opt.wrong { border-color:var(--bad); background:rgba(220,38,38,.08); }
.kc-fb { margin-top:12px; background:var(--bg); border-radius:10px; padding:10px 14px; font-size:14px; }
.foot { max-width:680px; width:100%; margin:40px auto 0; display:flex; justify-content:space-between; gap:12px; }
.btn { background:var(--accent); color:var(--accent-fg); border:none; border-radius:8px; padding:10px 18px;
  font-size:14px; font-weight:600; cursor:pointer; }
.btn.ghost { background:var(--surface); color:var(--fg); border:1px solid var(--border); }
.btn:disabled { opacity:.4; cursor:default; }
.done { text-align:center; padding:60px 20px; }
.done h2 { font-size:26px; } .done .score { font-size:44px; font-weight:700; margin:12px 0; }
@media (max-width:720px){ .wrap{flex-direction:column} .nav{width:auto;height:auto;position:static;
  border-right:none;border-bottom:1px solid var(--border)} }
`;

export const PLAYER_JS = `
(function(){
  var C = window.COURSE || { title:"", lessons:[] };
  var lessons = C.lessons || [];
  var viewed = {}, kc = {}, cur = 0, finished = false;
  var totalKC = 0;
  lessons.forEach(function(l){ (l.blocks||[]).forEach(function(b){ if(b.type==="knowledge_check") totalKC++; }); });

  function E(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
  function esc(s){ return String(s==null?"":s).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];}); }

  function renderAccordion(b){
    var wrap=E("div","acc");
    (b.items||[]).forEach(function(it){
      var item=E("div","acc-item");
      var head=E("button","acc-head",esc(it.title)+"<span class='car'>\\u25BE</span>");
      var body=E("div","acc-body",esc(it.body));
      head.onclick=function(){ item.className = item.className.indexOf("open")>-1 ? "acc-item" : "acc-item open"; };
      item.appendChild(head); item.appendChild(body); wrap.appendChild(item);
    });
    return wrap;
  }
  function renderKC(b){
    var wrap=E("div","kc");
    wrap.appendChild(E("p","kc-q",esc(b.question)));
    var answered=false;
    (b.options||[]).forEach(function(o){
      var btn=E("button","kc-opt",esc(o.text));
      btn.onclick=function(){
        if(answered) return; answered=true;
        var correct=!!o.correct; kc[b.id]=correct;
        var opts=wrap.querySelectorAll(".kc-opt");
        (b.options||[]).forEach(function(oo,i){
          opts[i].disabled=true;
          if(oo.correct) opts[i].className="kc-opt correct";
          else if(oo===o) opts[i].className="kc-opt wrong";
        });
        if(b.feedback) wrap.appendChild(E("div","kc-fb",esc(b.feedback)));
        var correctOpt=(b.options||[]).filter(function(x){return x.correct;})[0];
        if(window.LMS && LMS.recordInteraction) LMS.recordInteraction(b.id, correct, o.id, correctOpt?correctOpt.id:"", b.question);
      };
      wrap.appendChild(btn);
    });
    return wrap;
  }
  function renderBlock(b){
    switch(b.type){
      case "heading": return E("h"+(b.level||2),"blk-heading",esc(b.text));
      case "text": { var d=E("div","blk-text"); d.innerHTML=b.html||""; return d; }
      case "statement": return E("div","blk-statement",esc(b.text));
      case "image": { var f=E("figure","blk-image"); if(b.url){ var im=new Image(); im.src=b.url; im.alt=b.alt||""; f.appendChild(im);} if(b.caption)f.appendChild(E("figcaption",null,esc(b.caption))); return f; }
      case "divider": return E("hr","blk-divider");
      case "accordion": return renderAccordion(b);
      case "knowledge_check": return renderKC(b);
    }
    return E("div");
  }

  var nav=document.getElementById("nav"), main=document.getElementById("main");

  function buildNav(){
    nav.innerHTML=""; nav.appendChild(E("h1",null,esc(C.title)));
    lessons.forEach(function(l,i){
      var a=E("a",i===cur?"on":null,"<span class='n'>"+(i+1)+"</span>"+esc(l.title));
      a.onclick=function(){ cur=i; draw(); };
      nav.appendChild(a);
    });
  }
  function draw(){
    if(finished) return;
    viewed[cur]=true;
    buildNav();
    main.innerHTML="";
    var l=lessons[cur]; var wrap=E("div","lesson");
    wrap.appendChild(E("h2","title",esc(l.title)));
    (l.blocks||[]).forEach(function(b){ wrap.appendChild(renderBlock(b)); });
    var foot=E("div","foot");
    var prev=E("button","btn ghost","\\u2190 Previous"); prev.disabled=cur===0; prev.onclick=function(){ if(cur>0){cur--;draw();window.scrollTo(0,0);} };
    var allViewed=lessons.every(function(_,i){ return viewed[i]; });
    var next;
    if(cur < lessons.length-1){ next=E("button","btn","Next \\u2192"); next.onclick=function(){ cur++; draw(); window.scrollTo(0,0); }; }
    else { next=E("button","btn","Finish course"); next.disabled=!allViewed; next.onclick=finish; }
    foot.appendChild(prev); foot.appendChild(next);
    main.appendChild(wrap); main.appendChild(foot);
  }
  function finish(){
    finished=true;
    var correct=0; for(var k in kc){ if(kc[k]) correct++; }
    var passed=true;
    if(totalKC>0){ passed = (correct/totalKC) >= 0.8; if(window.LMS&&LMS.setScore) LMS.setScore(correct,0,totalKC); }
    if(window.LMS&&LMS.setCompleted) LMS.setCompleted(passed);
    if(window.LMS&&LMS.finish) LMS.finish();
    nav.innerHTML=""; main.innerHTML="";
    var d=E("div","done");
    d.appendChild(E("h2",null,"Course complete"));
    if(totalKC>0){ d.appendChild(E("div","score",correct+" / "+totalKC)); d.appendChild(E("p",null,passed?"Passed \\u2713":"Score recorded")); }
    else d.appendChild(E("p",null,"Your completion has been recorded."));
    main.appendChild(d);
  }

  if(window.LMS && LMS.init) LMS.init();
  window.addEventListener("beforeunload",function(){ if(!finished && window.LMS && LMS.finish) LMS.finish(); });
  draw();
})();
`;

export const SCORM_JS = `
window.LMS = (function(){
  var api=null, ver=null, n=0;
  function find(w){ var d=0; while(w&&d<12){ if(w.API){ver="1.2";return w.API;} if(w.API_1484_11){ver="2004";return w.API_1484_11;} if(w.parent===w)break; w=w.parent; d++; } return null; }
  function locate(){ var a=find(window); if(!a && window.opener) a=find(window.opener); return a; }
  function set(k,v){ try{ return ver==="1.2"?api.LMSSetValue(k,String(v)):api.SetValue(k,String(v)); }catch(e){} }
  function commit(){ try{ return ver==="1.2"?api.LMSCommit(""):api.Commit(""); }catch(e){} }
  return {
    init:function(){ api=locate(); if(!api) return false; try{ ver==="1.2"?api.LMSInitialize(""):api.Initialize(""); }catch(e){}
      set(ver==="1.2"?"cmi.core.lesson_status":"cmi.completion_status","incomplete"); commit(); return true; },
    recordInteraction:function(id,correct,learner,correctResp){ if(!api)return; var p="cmi.interactions."+n+".";
      set(p+"id",String(id).substring(0,255)); set(p+"type","choice");
      set(p+(ver==="1.2"?"student_response":"learner_response"),learner); set(p+"result",correct?"correct":"wrong");
      if(ver==="2004"&&correctResp) set(p+"correct_responses.0.pattern",correctResp); n++; commit(); },
    setScore:function(raw,min,max){ if(!api)return;
      if(ver==="1.2"){ set("cmi.core.score.raw",raw); set("cmi.core.score.min",min); set("cmi.core.score.max",max); }
      else { set("cmi.score.raw",raw); set("cmi.score.min",min); set("cmi.score.max",max); set("cmi.score.scaled", max?(raw/max).toFixed(4):"0"); } commit(); },
    setCompleted:function(passed){ if(!api)return;
      if(ver==="1.2") set("cmi.core.lesson_status", passed?"passed":"completed");
      else { set("cmi.completion_status","completed"); set("cmi.success_status", passed?"passed":"unknown"); } commit(); },
    finish:function(){ if(!api)return; commit(); try{ ver==="1.2"?api.LMSFinish(""):api.Terminate(""); }catch(e){} api=null; }
  };
})();
`;

export function xapiJs(activityId: string): string {
  return `
window.LMS = (function(){
  var q=new URLSearchParams(location.search);
  var endpoint=q.get("endpoint"), auth=q.get("auth"), actor=q.get("actor"), reg=q.get("registration");
  var ACT=${JSON.stringify(activityId)};
  var who; try{ who=actor?JSON.parse(actor):null; }catch(e){ who=null; }
  if(!who) who={ objectType:"Agent", account:{ name:"anonymous", homePage:"http://idstudio.local" } };
  var score=null;
  function send(stmt){ if(!endpoint) return; stmt.actor=who; stmt.timestamp=new Date().toISOString();
    if(reg){ stmt.context=stmt.context||{}; stmt.context.registration=reg; }
    try{ var x=new XMLHttpRequest(); x.open("POST", endpoint.replace(/\\/?$/,"/")+"statements", true);
      x.setRequestHeader("Content-Type","application/json"); x.setRequestHeader("X-Experience-API-Version","1.0.3");
      if(auth) x.setRequestHeader("Authorization", auth); x.send(JSON.stringify(stmt)); }catch(e){} }
  function verb(id,d){ return { id:id, display:{"en-US":d} }; }
  return {
    init:function(){ send({ verb:verb("http://adlnet.gov/expapi/verbs/initialized","initialized"), object:{objectType:"Activity",id:ACT} }); return true; },
    recordInteraction:function(id,correct,learner,correctResp,question){
      send({ verb:verb("http://adlnet.gov/expapi/verbs/answered","answered"),
        object:{ objectType:"Activity", id:ACT+"/"+id, definition:{ type:"http://adlnet.gov/expapi/activities/cmi.interaction", interactionType:"choice", description:{"en-US":question||""} } },
        result:{ success:!!correct, response:String(learner) } }); },
    setScore:function(raw,min,max){ score={ raw:raw, min:min, max:max, scaled: max?raw/max:0 }; },
    setCompleted:function(passed){
      send({ verb:verb("http://adlnet.gov/expapi/verbs/completed","completed"), object:{objectType:"Activity",id:ACT}, result:{ completion:true, success:!!passed, score:score||undefined } });
      if(passed) send({ verb:verb("http://adlnet.gov/expapi/verbs/passed","passed"), object:{objectType:"Activity",id:ACT}, result:{ success:true, score:score||undefined } }); },
    finish:function(){ send({ verb:verb("http://adlnet.gov/expapi/verbs/terminated","terminated"), object:{objectType:"Activity",id:ACT} }); }
  };
})();
`;
}

export function indexHtml(title: string, runtimeFile: string): string {
  const t = title.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title><link rel="stylesheet" href="styles.css"></head>
<body><div class="wrap"><nav class="nav" id="nav"></nav><div class="main" id="main"></div></div>
<script src="course-data.js"></script>
<script src="${runtimeFile}"></script>
<script src="player.js"></script>
</body></html>`;
}
