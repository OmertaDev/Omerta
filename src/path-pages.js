import {
  PATH_BY_ID,
  PATH_IDS,
  PATH_MANIFEST,
  PATH_QUIZ_QUESTIONS,
  PATH_SELECTION_RULES,
} from './path-funnel.js';

const esc = (value) => String(value == null ? '' : value).replace(/[<>&"']/g, (char) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
}[char]));

const safeJson = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

function originOf(value) {
  try { return new URL(value || 'https://www.omerta.fun').origin; }
  catch { return 'https://www.omerta.fun'; }
}

const money = (amount) => `$${Number(amount).toLocaleString('en-US')}`;
const days = (milliseconds) => Math.round(Number(milliseconds) / 86_400_000);

function sharedHead({ title, description, canonical, image, accent = '#cda653' }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#0a0909">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="OMERTÀ">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="stylesheet" href="/omerta-ui.css?v=20260826">
<style>:root{--path-accent:${esc(accent)}}</style>`;
}

function nav({ quiz = false } = {}) {
  return `<a class="skip-link" href="#main">Skip to content</a>
<nav class="public-nav" aria-label="Primary">
  <a class="public-nav__brand" href="/" aria-label="OMERTÀ home">OMERTÀ</a>
  <div class="public-nav__links path-nav-links">
    <a href="/">The City</a>
    <a href="/wiki#paths">Codex</a>
    ${quiz ? '<a aria-current="page" href="/path">Path Quiz</a>' : '<a href="/path">Retake Quiz</a>'}
  </div>
</nav>`;
}

const styles = `<style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0}button,a{touch-action:manipulation}
.path-nav-links a{min-height:44px;display:inline-flex;align-items:center;padding:0 12px;color:var(--om-text-muted);font:700 11px/1 var(--om-font-data);letter-spacing:.09em;text-decoration:none;text-transform:uppercase}
.path-nav-links a:hover,.path-nav-links a[aria-current=page]{color:var(--om-text-primary)}
.path-shell{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:72px 0 96px}
.path-kicker{margin:0 0 18px;color:var(--path-accent);font:700 11px/1.4 var(--om-font-data);letter-spacing:.18em;text-transform:uppercase}
.path-display{max-width:980px;margin:0;font:600 clamp(50px,9vw,96px)/.84 var(--om-font-display);letter-spacing:.015em;text-transform:uppercase;text-wrap:balance}
.path-display mark{padding:0 .05em;color:var(--om-surface-canvas);background:var(--path-accent)}
.path-deck{max-width:770px;margin:28px 0 0;color:var(--om-text-secondary);font:400 clamp(19px,2.1vw,27px)/1.45 var(--om-font-body);text-wrap:balance}
.path-rule{height:1px;margin:46px 0;background:linear-gradient(90deg,var(--path-accent),var(--om-border-subtle) 28%,transparent)}
.path-button{min-height:50px;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:0 20px;border:1px solid var(--path-accent);border-radius:var(--om-radius-sm);color:var(--om-surface-canvas);background:var(--path-accent);cursor:pointer;font:800 12px/1 var(--om-font-data);letter-spacing:.09em;text-decoration:none;text-transform:uppercase;transition:transform var(--om-duration-fast) var(--om-ease-out),filter var(--om-duration-fast) var(--om-ease-out)}
.path-button:hover{filter:brightness(1.12);transform:translateY(-1px)}.path-button:active{transform:translateY(0) scale(.99)}.path-button--quiet{color:var(--om-text-primary);background:transparent;border-color:var(--om-border-strong)}
.path-button--quiet:hover{border-color:var(--path-accent)}.path-button:disabled{opacity:.45;cursor:wait;transform:none}
.path-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:32px}
.path-fine{color:var(--om-text-muted);font:400 13px/1.65 var(--om-font-data)}
.path-fine a{color:var(--om-text-secondary)}
.quiz-frame{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:54px;align-items:start;margin-top:58px}
.quiz-card{min-height:470px;padding:clamp(24px,4vw,48px);border:1px solid var(--om-border-strong);background:linear-gradient(145deg,color-mix(in srgb,var(--path-accent) 7%,var(--om-surface-panel)),var(--om-surface-sunken))}
.quiz-progress{display:flex;align-items:center;gap:16px;margin-bottom:34px;color:var(--om-text-muted);font:700 11px/1 var(--om-font-data);letter-spacing:.12em;text-transform:uppercase}
.quiz-progress__track{height:2px;flex:1;background:var(--om-border-subtle)}.quiz-progress__fill{display:block;height:100%;background:var(--path-accent);transform:scaleX(var(--quiz-progress,.143));transform-origin:left;transition:transform var(--om-duration-base) var(--om-ease-out)}
.quiz-eyebrow{margin:0 0 12px;color:var(--path-accent);font:700 11px/1.2 var(--om-font-data);letter-spacing:.16em;text-transform:uppercase}
.quiz-prompt{max-width:760px;margin:0 0 28px;font:600 clamp(28px,4vw,48px)/1.02 var(--om-font-display);text-transform:uppercase;text-wrap:balance}
.quiz-options{display:grid;gap:9px}.quiz-option{position:relative;width:100%;min-height:66px;padding:14px 48px 14px 18px;border:1px solid var(--om-border-subtle);border-radius:var(--om-radius-sm);color:var(--om-text-secondary);background:color-mix(in srgb,var(--om-surface-raised) 84%,transparent);cursor:pointer;font:400 16px/1.4 var(--om-font-body);text-align:left;transition:border-color var(--om-duration-fast),color var(--om-duration-fast),background var(--om-duration-fast)}
.quiz-option::after{content:'→';position:absolute;right:18px;top:50%;color:var(--path-accent);font-family:var(--om-font-data);transform:translateY(-50%)}
.quiz-option:hover,.quiz-option:focus-visible{border-color:var(--path-accent);color:var(--om-text-primary);background:color-mix(in srgb,var(--path-accent) 8%,var(--om-surface-raised))}.quiz-option:active{transform:scale(.995)}
.quiz-back{min-height:44px;margin-top:18px;padding:0;border:0;color:var(--om-text-muted);background:transparent;cursor:pointer;font:700 11px/1 var(--om-font-data);letter-spacing:.1em;text-transform:uppercase}.quiz-back[hidden]{display:none}.quiz-back:hover{color:var(--om-text-primary)}
.quiz-aside{position:sticky;top:92px;padding-top:14px;border-top:1px solid var(--path-accent)}
.quiz-aside h2{margin:0 0 14px;font:600 20px/1 var(--om-font-display);letter-spacing:.05em;text-transform:uppercase}.quiz-aside p{margin:0 0 18px;color:var(--om-text-muted);font:400 14px/1.65 var(--om-font-body)}
.quiz-terms{display:grid;gap:12px;margin:24px 0 0}.quiz-term{display:grid;grid-template-columns:1fr auto;gap:14px;padding-bottom:12px;border-bottom:1px solid var(--om-border-subtle)}.quiz-term dt{color:var(--om-text-muted);font:700 10px/1.3 var(--om-font-data);letter-spacing:.09em;text-transform:uppercase}.quiz-term dd{margin:0;color:var(--om-text-primary);font:700 12px/1.3 var(--om-font-data);text-align:right}
.quiz-error{margin:18px 0 0;color:var(--om-status-danger);font:700 12px/1.5 var(--om-font-data)}
.result-hero{position:relative;padding-bottom:8px}.result-stamp{display:inline-flex;align-items:center;gap:10px;margin-bottom:28px;padding:9px 12px;border:1px solid var(--path-accent);color:var(--path-accent);font:700 10px/1 var(--om-font-data);letter-spacing:.14em;text-transform:uppercase}.result-stamp::before{content:'';width:7px;height:7px;border:1px solid var(--path-accent);border-radius:50%;background:var(--path-accent);box-shadow:0 0 16px var(--path-accent)}
.result-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:54px;align-items:start}.result-brief{padding:30px;border:1px solid var(--om-border-strong);background:linear-gradient(145deg,color-mix(in srgb,var(--path-accent) 8%,var(--om-surface-panel)),var(--om-surface-sunken))}
.result-brief__label{margin:0 0 12px;color:var(--om-text-muted);font:700 10px/1 var(--om-font-data);letter-spacing:.13em;text-transform:uppercase}.result-brief__role{margin:0 0 24px;font:600 28px/1.05 var(--om-font-display);text-transform:uppercase}.result-brief p{color:var(--om-text-secondary);font:400 16px/1.55 var(--om-font-body)}
.secondary-result{display:none;margin:20px 0 0;padding-top:18px;border-top:1px solid var(--om-border-subtle);color:var(--om-text-muted);font:400 13px/1.5 var(--om-font-data)}.secondary-result[data-visible=true]{display:block}.secondary-result strong{color:var(--om-text-primary)}
.section-label{margin:0 0 10px;color:var(--path-accent);font:700 10px/1 var(--om-font-data);letter-spacing:.16em;text-transform:uppercase}.section-title{margin:0;font:600 clamp(32px,5vw,60px)/.95 var(--om-font-display);text-transform:uppercase;text-wrap:balance}.section-deck{max-width:780px;margin:18px 0 0;color:var(--om-text-muted);font:400 17px/1.6 var(--om-font-body)}
.effect-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:30px}.effect-card{min-height:170px;padding:24px;border:1px solid var(--om-border-subtle);background:var(--om-surface-panel)}.effect-card[data-impact=edge]{border-top-color:var(--path-accent)}.effect-card[data-impact=cost]{border-top-color:var(--om-status-danger)}.effect-kind{display:flex;justify-content:space-between;gap:16px;color:var(--om-text-muted);font:700 10px/1 var(--om-font-data);letter-spacing:.1em;text-transform:uppercase}.effect-card[data-impact=edge] .effect-kind span:last-child{color:var(--path-accent)}.effect-card[data-impact=cost] .effect-kind span:last-child{color:var(--om-status-danger)}.effect-value{margin:22px 0 6px;color:var(--om-text-primary);font:600 46px/.9 var(--om-font-display)}.effect-label{margin:0;color:var(--om-text-secondary);font:400 15px/1.45 var(--om-font-body)}
.mastery-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:30px}.mastery-lane{padding:26px;border:1px solid var(--om-border-subtle);background:var(--om-surface-panel)}.mastery-lane--rival{background:var(--om-surface-sunken)}.mastery-head{display:flex;align-items:end;justify-content:space-between;gap:20px;padding-bottom:18px;border-bottom:1px solid var(--om-border-subtle)}.mastery-head h3{margin:0;font:600 24px/1 var(--om-font-display);text-transform:uppercase}.mastery-rate{color:var(--path-accent);font:700 22px/1 var(--om-font-data)}.mastery-lane--rival .mastery-rate{color:var(--om-status-danger)}.mastery-list{display:grid;gap:20px;margin:22px 0 0;padding:0;list-style:none}.mastery-list strong{display:block;margin-bottom:6px;color:var(--om-text-primary);font:700 12px/1.2 var(--om-font-data);letter-spacing:.08em;text-transform:uppercase}.mastery-list span{color:var(--om-text-muted);font:400 14px/1.5 var(--om-font-body)}
.operations-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:32px;margin-top:30px}.operations-panel{padding:28px;border:1px solid var(--om-border-subtle);background:var(--om-surface-panel)}.operations-panel h3{margin:0 0 20px;font:600 22px/1 var(--om-font-display);letter-spacing:.04em;text-transform:uppercase}.loop-list{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}.loop-list li{padding:9px 11px;border:1px solid var(--om-border-strong);color:var(--om-text-secondary);font:700 10px/1 var(--om-font-data);letter-spacing:.08em;text-transform:uppercase}.playbook{counter-reset:steps;display:grid;gap:16px;margin:0;padding:0;list-style:none}.playbook li{position:relative;padding-left:42px;color:var(--om-text-secondary);font:400 16px/1.5 var(--om-font-body)}.playbook li::before{counter-increment:steps;content:'0' counter(steps);position:absolute;left:0;top:.35em;color:var(--path-accent);font:700 10px/1 var(--om-font-data)}
.social-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;margin-top:30px}.social-card{margin:0;border:1px solid var(--om-border-subtle);background:var(--om-surface-panel);overflow:hidden}.social-card__frame{height:clamp(330px,42vw,470px);overflow:hidden;border-bottom:1px solid var(--om-border-subtle);background:var(--om-surface-canvas)}.social-card__frame img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}.social-card figcaption{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px}.social-card__meta{min-width:0}.social-card__meta strong{display:block;margin-bottom:6px;color:var(--om-text-primary);font:600 20px/1 var(--om-font-display);text-transform:uppercase}.social-card__meta span{color:var(--om-text-muted);font:700 10px/1.3 var(--om-font-data);letter-spacing:.1em;text-transform:uppercase}.social-download{flex:0 0 auto;min-height:44px;padding-inline:15px;font-size:10px}
.result-footer{margin-top:70px;padding:36px;border:1px solid var(--om-border-strong);background:linear-gradient(100deg,color-mix(in srgb,var(--path-accent) 8%,var(--om-surface-panel)),var(--om-surface-sunken))}.result-footer h2{max-width:780px;margin:0;font:600 clamp(32px,5vw,62px)/.94 var(--om-font-display);text-transform:uppercase}.result-footer p{max-width:700px;color:var(--om-text-muted);font:400 16px/1.55 var(--om-font-body)}
.path-index{margin-top:62px}.path-index h2{margin:0 0 18px;color:var(--om-text-muted);font:700 10px/1 var(--om-font-data);letter-spacing:.14em;text-transform:uppercase}.path-index__links{display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid var(--om-border-subtle);border-left:1px solid var(--om-border-subtle)}.path-index__links a{min-height:88px;display:flex;flex-direction:column;justify-content:center;padding:16px;border-right:1px solid var(--om-border-subtle);border-bottom:1px solid var(--om-border-subtle);color:var(--om-text-primary);text-decoration:none}.path-index__links a span{margin-bottom:6px;color:var(--om-text-muted);font:700 9px/1 var(--om-font-data);letter-spacing:.12em;text-transform:uppercase}.path-index__links a strong{font:600 18px/1 var(--om-font-display);text-transform:uppercase}.path-index__links a:hover{background:var(--om-surface-panel)}
@media(max-width:820px){.path-shell{width:min(100% - 28px,680px);padding:48px 0 72px}.path-nav-links a:first-child{display:none}.quiz-frame,.result-grid,.operations-grid{grid-template-columns:1fr;gap:28px}.quiz-aside{position:static}.effect-grid,.mastery-grid{grid-template-columns:1fr}.path-index__links{grid-template-columns:1fr 1fr}.result-brief{padding:24px}.result-footer{padding:26px}.path-display{font-size:clamp(48px,18vw,82px)}}
@media(max-width:620px){.social-grid{grid-template-columns:1fr}.social-card__frame{height:clamp(340px,125vw,500px)}}
@media(max-width:480px){.public-nav{padding-inline:14px}.public-nav__brand{font-size:17px}.path-nav-links a{padding-inline:8px;font-size:9px}.quiz-card{padding:20px}.quiz-prompt{font-size:30px}.quiz-option{font-size:15px}.path-index__links{grid-template-columns:1fr}.effect-card{min-height:150px}.path-actions{display:grid}.path-button{width:100%}.social-card figcaption{align-items:stretch;flex-direction:column}.social-download{width:100%}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.path-button,.quiz-progress__fill{transition:none}}
@media(forced-colors:active){.path-display mark{color:Canvas;background:Highlight}.quiz-card,.result-brief,.effect-card,.mastery-lane,.operations-panel,.social-card,.result-footer,.path-index__links a{border-color:CanvasText}.path-button,.quiz-option{forced-color-adjust:auto}.result-stamp::before{box-shadow:none}}
</style>`;

function sessionScript() {
  return `function pathSession(){
  var key='omerta_path_session';
  try{var saved=sessionStorage.getItem(key);if(saved)return saved;var made=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2));sessionStorage.setItem(key,made);return made}catch(_){return 'ephemeral-'+Math.random().toString(36).slice(2)}
}
function pathTrack(payload){
  return fetch('/v1/path-quiz',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({session:pathSession()},payload)),keepalive:true}).then(function(response){if(!response.ok)throw new Error('telemetry');return response.json()})
}`;
}

export function renderPathQuizPage({ baseUrl } = {}) {
  const origin = originOf(baseUrl);
  const title = 'Which OMERTÀ Path Are You?';
  const description = 'Seven decisions reveal how you would operate in OMERTÀ: Gun, Ledger, Kitchen, Wheel, Shadow, or Ring. Every result includes its exact mechanical edge and cost.';
  const canonical = `${origin}/path`;
  const image = `${origin}/art/gameplay-01-choose-your-path.png`;
  const questions = PATH_QUIZ_QUESTIONS.map(({ id, eyebrow, prompt, options }) => ({
    id, eyebrow, prompt, options: options.map(({ id: optionId, label }) => ({ id: optionId, label })),
  }));

  return `<!doctype html>
<html lang="en"><head>
${sharedHead({ title, description, canonical, image })}
${styles}
</head><body class="public-page" data-page="path-quiz">
${nav({ quiz: true })}
<main id="main" class="path-shell">
  <header>
    <p class="path-kicker">OMERTÀ // OPERATING DOCTRINE</p>
    <h1 class="path-display">Which <mark>Path</mark> are you?</h1>
    <p class="path-deck">Seven decisions. Six operating doctrines. One result grounded in the same signed modifiers that run the city.</p>
  </header>
  <div class="quiz-frame">
    <form id="path-quiz" class="quiz-card" novalidate>
      <div class="quiz-progress" aria-hidden="true"><span data-progress-label>Decision 1 of ${questions.length}</span><span class="quiz-progress__track"><span class="quiz-progress__fill" data-progress-fill style="--quiz-progress:${1 / questions.length}"></span></span></div>
      <div data-question-host aria-live="polite"></div>
      <button class="quiz-back" type="button" data-quiz-back hidden>← Previous decision</button>
      <p class="quiz-error" data-quiz-error role="alert" hidden></p>
    </form>
    <aside class="quiz-aside" aria-label="Path selection rules">
      <h2>The signed terms</h2>
      <p>The quiz recommends a doctrine; it does not choose in-game. At level ${PATH_SELECTION_RULES.unlockLevel}, the city lets you make that choice yourself.</p>
      <dl class="quiz-terms">
        <div class="quiz-term"><dt>First choice</dt><dd>${money(PATH_SELECTION_RULES.firstPickCash)} cash</dd></div>
        <div class="quiz-term"><dt>Switching</dt><dd>${PATH_SELECTION_RULES.switchOmr} $OMR</dd></div>
        <div class="quiz-term"><dt>Switch clock</dt><dd>${days(PATH_SELECTION_RULES.switchCooldownMs)} days</dd></div>
        <div class="quiz-term"><dt>Home mastery</dt><dd>×${PATH_SELECTION_RULES.homeMasteryMultiplier}</dd></div>
        <div class="quiz-term"><dt>Rival mastery</dt><dd>×${PATH_SELECTION_RULES.rivalMasteryMultiplier}</dd></div>
      </dl>
      <p class="path-fine">Want the rules before the questions? <a href="/wiki#paths">Inspect all six Paths in the Codex.</a></p>
    </aside>
  </div>
  <noscript><div class="path-index"><h2>JavaScript is off — inspect each doctrine directly</h2><div class="path-index__links">${PATH_MANIFEST.map((path) => `<a href="${path.resultUrl}"><span>${esc(path.archetype)}</span><strong>${esc(path.name)}</strong></a>`).join('')}</div></div></noscript>
</main>
<script type="application/json" id="path-questions">${safeJson(questions)}</script>
<script>
${sessionScript()}
(function(){
  var questions=JSON.parse(document.getElementById('path-questions').textContent);
  var form=document.getElementById('path-quiz'),host=form.querySelector('[data-question-host]'),back=form.querySelector('[data-quiz-back]'),error=form.querySelector('[data-quiz-error]'),label=form.querySelector('[data-progress-label]'),fill=form.querySelector('[data-progress-fill]');
  var index=0,answers={},busy=false;
  var params=new URLSearchParams(location.search);var requestedSource=params.get('source');var source=requestedSource||'direct';
  if(!requestedSource&&document.referrer){try{if(new URL(document.referrer).origin===location.origin)source='site'}catch(_){}}
  pathTrack({event:'start',source:source}).catch(function(){});
  function node(tag,className,text){var element=document.createElement(tag);if(className)element.className=className;if(text)element.textContent=text;return element}
  function render(){
    var question=questions[index];host.replaceChildren();label.textContent='Decision '+(index+1)+' of '+questions.length;fill.style.setProperty('--quiz-progress',(index+1)/questions.length);back.hidden=index===0||busy;
    var eyebrow=node('p','quiz-eyebrow',question.eyebrow),heading=node('h2','quiz-prompt',question.prompt);heading.id='quiz-question';host.append(eyebrow,heading);
    var choices=node('div','quiz-options');choices.setAttribute('role','group');choices.setAttribute('aria-labelledby',heading.id);
    question.options.forEach(function(option){var button=node('button','quiz-option',option.label);button.type='button';button.dataset.option=option.id;button.addEventListener('click',function(){choose(question,option,button)});choices.append(button)});host.append(choices);
  }
  function choose(question,option,button){
    if(busy)return;answers[question.id]=option.id;pathTrack({event:'answer',question:question.id,option:option.id,step:index+1}).catch(function(){});
    if(index<questions.length-1){index++;render();return}
    busy=true;form.setAttribute('aria-busy','true');button.textContent='Reading the city…';Array.from(form.querySelectorAll('button')).forEach(function(item){item.disabled=true});error.hidden=true;
    pathTrack({event:'complete',answers:answers,source:source}).then(function(result){if(!result.url)throw new Error('missing result');location.assign(result.url)}).catch(function(){busy=false;form.removeAttribute('aria-busy');error.textContent='The line went dead. Your answers are safe — try the final decision again.';error.hidden=false;render()});
  }
  back.addEventListener('click',function(){if(index>0){index--;render()}});form.addEventListener('submit',function(event){event.preventDefault()});render();
})();
</script>
</body></html>`;
}

function renderEffects(path) {
  return path.effects.map((effect, index) => `<article class="effect-card" data-impact="${effect.impact}">
  <div class="effect-kind"><span>${effect.kind === 'additive' ? 'Additive modifier' : 'Signed multiplier'}</span><span>${effect.impact === 'edge' ? 'Edge' : 'Cost'}</span></div>
  <p class="effect-value">${esc(effect.display)}</p>
  <p class="effect-label">${esc(effect.label)}</p>
  <span class="visually-hidden">Rule key ${esc(effect.key)}, value ${esc(effect.value)}, item ${index + 1}</span>
</article>`).join('');
}

function renderMasteryLane(title, tracks, multiplier, rival = false) {
  return `<article class="mastery-lane${rival ? ' mastery-lane--rival' : ''}">
  <div class="mastery-head"><h3>${esc(title)}</h3><span class="mastery-rate">×${esc(multiplier)} XP</span></div>
  <ul class="mastery-list">${tracks.map((track) => `<li><strong>${esc(track.name)}</strong><span>${esc(track.description)}</span></li>`).join('')}</ul>
</article>`;
}

export function renderPathResultPage(id, { baseUrl } = {}) {
  const path = Object.hasOwn(PATH_BY_ID, id) ? PATH_BY_ID[id] : null;
  if (!path) return null;
  const origin = originOf(baseUrl);
  const title = `${path.copy.resultTitle} | OMERTÀ Path`;
  const canonical = `${origin}${path.resultUrl}`;
  const image = `${origin}${path.shareCard}`;
  const otherPaths = PATH_MANIFEST.filter((entry) => entry.id !== path.id);
  const pathNames = Object.fromEntries(PATH_MANIFEST.map((entry) => [entry.id, entry.name]));

  return `<!doctype html>
<html lang="en"><head>
${sharedHead({ title, description: path.copy.metaDescription, canonical, image, accent: path.accent })}
${styles}
</head><body class="public-page" data-page="path-result" data-path="${path.id}">
${nav()}
<main id="main" class="path-shell">
  <section class="result-hero" aria-labelledby="result-title">
    <div class="result-stamp">Path analysis // ${esc(path.icon)}</div>
    <div class="result-grid">
      <div>
        <p class="path-kicker">${esc(path.archetype)} // ${esc(path.role)}</p>
        <h1 id="result-title" class="path-display">You are <mark>${esc(path.name)}</mark></h1>
        <p class="path-deck">${esc(path.copy.resultDeck)}</p>
        <div class="path-actions">
          <a class="path-button" data-path-cta="play" href="${path.links.play}">Enter the city</a>
          <button class="path-button path-button--quiet" type="button" data-share-result aria-live="polite">Share this result</button>
          <a class="path-button path-button--quiet" data-path-cta="retake" href="/path">Retake the quiz</a>
        </div>
      </div>
      <aside class="result-brief">
        <p class="result-brief__label">Your operating doctrine</p>
        <h2 class="result-brief__role">${esc(path.promise)}</h2>
        <p><strong>Best fit:</strong> ${esc(path.fit)}</p>
        <p><strong>The cost you accept:</strong> ${esc(path.notFit)}</p>
        <p class="secondary-result" data-secondary>Your secondary instinct is <strong data-secondary-name></strong>. It breaks ties in your style; it does not change this Path’s signed modifiers.</p>
      </aside>
    </div>
  </section>

  <div class="path-rule"></div>
  <section aria-labelledby="mechanics-title">
    <p class="section-label">01 / THE SIGNED MODIFIERS</p>
    <h2 id="mechanics-title" class="section-title">Every edge. Every cost.</h2>
    <p class="section-deck">These are not personality-test flourishes. They are the exact values inherited from the rule matrix that resolves play.</p>
    <div class="effect-grid">${renderEffects(path)}</div>
  </section>

  <div class="path-rule"></div>
  <section aria-labelledby="mastery-title">
    <p class="section-label">02 / MASTERY PRESSURE</p>
    <h2 id="mastery-title" class="section-title">Two schools accelerate. Two resist.</h2>
    <p class="section-deck">Your Path changes how quickly specific mastery lanes school. It does not erase the rest of the city.</p>
    <div class="mastery-grid">
      ${renderMasteryLane('Home schools', path.mastery.home, path.mastery.homeMultiplier)}
      ${renderMasteryLane('Rival schools', path.mastery.rival, path.mastery.rivalMultiplier, true)}
    </div>
  </section>

  <div class="path-rule"></div>
  <section aria-labelledby="operations-title">
    <p class="section-label">03 / FIELD DOCTRINE</p>
    <h2 id="operations-title" class="section-title">Where your advantage becomes work.</h2>
    <div class="operations-grid">
      <article class="operations-panel"><h3>Natural loops</h3><ul class="loop-list">${path.loops.map((loop) => `<li>${esc(loop)}</li>`).join('')}</ul></article>
      <article class="operations-panel"><h3>Three-move playbook</h3><ol class="playbook">${path.playbook.map((move) => `<li>${esc(move)}</li>`).join('')}</ol></article>
    </div>
  </section>

  <div class="path-rule"></div>
  <section aria-labelledby="social-title">
    <p class="section-label">04 / SOCIAL KIT</p>
    <h2 id="social-title" class="section-title">Take your doctrine with you.</h2>
    <p class="section-deck">Portrait and story crops carrying the same signed modifiers, mastery pressure, and opening doctrine as this dossier.</p>
    <div class="social-grid">
      <figure class="social-card">
        <div class="social-card__frame"><img src="${path.socialCards.portrait}" width="1080" height="1350" loading="lazy" decoding="async" alt="${esc(path.name)} portrait field card with exact modifiers, mastery lanes, and three-move playbook"></div>
        <figcaption><span class="social-card__meta"><strong>Portrait field card</strong><span>4:5 // 1080 × 1350</span></span><a class="path-button path-button--quiet social-download" data-path-cta="download_portrait" href="${path.socialCards.portrait}" download="omerta-path-${path.id}-portrait.png">Download PNG</a></figcaption>
      </figure>
      <figure class="social-card">
        <div class="social-card__frame"><img src="${path.socialCards.vertical}" width="1080" height="1920" loading="lazy" decoding="async" alt="${esc(path.name)} vertical field card with exact modifiers, mastery lanes, and three-move playbook"></div>
        <figcaption><span class="social-card__meta"><strong>Story field card</strong><span>9:16 // 1080 × 1920</span></span><a class="path-button path-button--quiet social-download" data-path-cta="download_vertical" href="${path.socialCards.vertical}" download="omerta-path-${path.id}-story.png">Download PNG</a></figcaption>
      </figure>
    </div>
  </section>

  <section class="result-footer" aria-labelledby="result-cta-title">
    <p class="section-label">YOUR RESULT IS A DOCTRINE, NOT A PROMISE</p>
    <h2 id="result-cta-title">${esc(path.promise)}</h2>
    <p>Choose a Path in-game at level ${PATH_SELECTION_RULES.unlockLevel} after paying ${money(PATH_SELECTION_RULES.firstPickCash)} cash. Switching costs ${PATH_SELECTION_RULES.switchOmr} $OMR and starts a ${days(PATH_SELECTION_RULES.switchCooldownMs)}-day clock. Inspect the complete rulebook before you commit.</p>
    <div class="path-actions">
      <a class="path-button" data-path-cta="play" href="${path.links.play}">Play as a guest</a>
      <a class="path-button path-button--quiet" data-path-cta="codex" href="${path.links.codex}">Inspect Paths in the Codex</a>
    </div>
  </section>

  <nav class="path-index" aria-label="Compare the other Paths"><h2>Compare the other doctrines</h2><div class="path-index__links">${otherPaths.map((other) => `<a href="${other.resultUrl}"><span>${esc(other.archetype)}</span><strong>${esc(other.name)}</strong></a>`).join('')}</div></nav>
</main>
<script type="application/json" id="path-result-data">${safeJson({ id: path.id, canonical, shareLine: path.copy.shareLine, pathNames })}</script>
<script>
${sessionScript()}
(function(){
  var data=JSON.parse(document.getElementById('path-result-data').textContent);var secondary=new URLSearchParams(location.search).get('secondary');var box=document.querySelector('[data-secondary]');
  if(secondary&&secondary!==data.id&&data.pathNames[secondary]){box.querySelector('[data-secondary-name]').textContent=data.pathNames[secondary];box.dataset.visible='true'}
  pathTrack({event:'result_view',path:data.id,secondary:secondary&&data.pathNames[secondary]?secondary:null,source:'result'}).catch(function(){});
  document.querySelectorAll('[data-path-cta]').forEach(function(link){link.addEventListener('click',function(){pathTrack({event:'cta_click',path:data.id,cta:link.dataset.pathCta,source:'result'}).catch(function(){})})});
  var share=document.querySelector('[data-share-result]');share.addEventListener('click',function(){
    var payload={title:document.title,text:data.shareLine,url:data.canonical};var done;
    if(navigator.share)done=navigator.share(payload);else done=navigator.clipboard.writeText(data.shareLine+' '+data.canonical).then(function(){share.textContent='Result link copied'});
    Promise.resolve(done).then(function(){return pathTrack({event:'share',path:data.id,channel:navigator.share?'native':'clipboard',source:'result'})}).catch(function(){});
  });
})();
</script>
</body></html>`;
}
