import { createHash } from 'node:crypto';
import { landingLoader } from '../public/landing-loader.js';

const version = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const tagged = (url, revision) => `${url}${url.includes('?') ? '&' : '?'}client=${revision}`;

// Keep one reviewed game source. Only its transport changes: a public visitor receives the
// landing document, while deliberate entry or a saved session loads the original program.
export function prepareClientShell(source, readAsset = () => null) {
  const html = source.replaceAll('\r\n', '\n');
  const runtime = html.match(/<script>\n(\(\(\) => \{[\s\S]*?)\n<\/script>\s*<\/body>/)?.[1];
  if (!runtime) throw new Error('The canonical game runtime is missing.');
  const revision = version(html);
  const scripts = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)].map(match => match[1]);
  const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g)]
    .map(match => match[1]).filter(url => !url.startsWith('/omerta-ui.css'));
  if (!scripts.length || [...scripts, ...styles].some(url => !/^\/[a-z0-9][a-z0-9_./?=&-]*$/i.test(url) || url.split(/[/?]/).includes('..')))
    throw new Error('Game dependencies must remain explicit local assets.');
  const languageStart = runtime.indexOf('  const I18N = {');
  const languageEnd = runtime.indexOf('  const LANG = ', languageStart);
  if (languageStart < 0 || languageEnd < 0) throw new Error('The canonical language packs are missing.');
  const scenes = runtime.match(/const LINES = (\[[\s\S]*?\]);/)?.[1];
  if (!scenes) throw new Error('The canonical editorial scenes are missing.');
  const dependency = url => tagged(url, version(readAsset(url.split('?')[0]) || html));
  const config = { runtime: `/game-runtime.js?v=${revision}`, scripts: scripts.map(dependency), styles: styles.map(dependency) };
  const loader = `(${landingLoader.toString().replaceAll('\r\n', '\n')})();`.replace('/* OMERTA_LANDING_CONFIG */', `const CONFIG = ${JSON.stringify(config)};`)
    .replace('/* OMERTA_LANDING_LANGUAGES */', runtime.slice(languageStart, languageEnd))
    .replace('/* OMERTA_LANDING_SCENES */', `const scenes = ${scenes};`);
  let landing = html.replace(`<script>\n${runtime}\n</script>`, '')
    .replace(/<script src="[^"]+"[^>]*><\/script>/g, '')
    .replace(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g, (tag, url) => styles.includes(url) ? '' : tag)
    .replace('id="screen-auth" class="landing hidden"', 'id="screen-auth" class="landing"');
  landing = landing.replace(/(<p id="guest-status"[^>]*><\/p>)/,
    '$1<p id="client-load-failure" class="ctahint" role="alert" hidden>The city could not load. Check your connection, then <button class="act" type="button" onclick="location.reload()">reload the page</button>.</p>');
  const transport = '<script>(()=>{const failure=document.getElementById("client-load-failure");const timer=setTimeout(()=>{failure.hidden=false},15000);window.OmertaLandingTransport={failed(){clearTimeout(timer);failure.hidden=false},loaded(){clearTimeout(timer);failure.hidden=window.OmertaLandingReady===true}}})();</script>';
  landing = landing.replace('</body>', '<noscript><p class="center">JavaScript is needed to enter the city. You can still read the <a href="/wiki">Codex</a> or the <a href="/play">agent setup guide</a>.</p></noscript>'
    + transport + `<script src="/landing-loader.js?v=${version(loader)}" defer onload="window.OmertaLandingTransport.loaded()" onerror="window.OmertaLandingTransport.failed()"></script>\n</body>`);
  return Object.freeze({ html: landing, runtime, loader, revision, loaderRevision: version(loader), scripts: Object.freeze(scripts), styles: Object.freeze(styles) });
}
