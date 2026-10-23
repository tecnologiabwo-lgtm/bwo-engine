import {state} from './panel/state.js';
import {boot,setView} from './panel/shell.js';
import {setTab,setPage,playStories} from './panel/feed.js';
import './panel/editor.js';
import './panel/wizard.js';
import './panel/media.js';
import './panel/planning.js';
import './panel/settings.js';
/* Puente mínimo para los pocos manejadores declarados en plantillas compartidas. */
window.P={tab:setTab,page:setPage,stories:playStories,view:setView,state};
boot();
