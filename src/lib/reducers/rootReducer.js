import { combineReducers } from 'redux';

const EXPIRY_MS = 90 * 60 * 1000; // 1h30
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

const initialAuth = { isAuthenticated: false, isGuest: false, user: null, token: null, apiUser: null };

function authReducer(state = initialAuth, action) {
  switch (action.type) {
    case 'AUTH_LOGIN_SUCCESS':
      return { ...state, isAuthenticated: true, isGuest: false, user: action.payload.user, token: action.payload.token, apiUser: action.payload.apiUser ?? null };
    case 'AUTH_GUEST_LOGIN':
      return { ...state, isGuest: true };
    case 'AUTH_API_USER_UPDATED':
      return { ...state, apiUser: action.payload };
    case 'AUTH_API_USER_PERMISSION_UPDATED':
      return { ...state, apiUser: state.apiUser ? { ...state.apiUser, ...action.payload } : state.apiUser };
    case 'USER_UPDATE_PROFILE':
      return { ...state, user: { ...state.user, ...action.payload } };
    case 'AUTH_LOGOUT':
      return initialAuth;
    default:
      return state;
  }
}

// `known` = mosques saved from janaza declarations (OSM data) or manually added by users
const initialMosques = { known: [], subscriptions: [] };

function mosquesReducer(state = initialMosques, action) {
  switch (action.type) {
    case 'MOSQUE_REGISTER':
    case 'MOSQUE_ADD_USER': {
      const already = state.known.some((m) => m.id === action.payload.id);
      if (already) return state;
      return { ...state, known: [action.payload, ...state.known] };
    }
    case 'MOSQUE_SUBSCRIBE': {
      const already = state.subscriptions.some((s) => s.id === action.payload.id);
      if (already) return state;
      return {
        ...state,
        subscriptions: [...state.subscriptions, { ...action.payload, notifActive: true }],
      };
    }
    case 'MOSQUE_UNSUBSCRIBE':
      return {
        ...state,
        subscriptions: state.subscriptions.filter((s) => s.id !== action.payload.id),
      };
    case 'MOSQUE_TOGGLE_NOTIF':
      return {
        ...state,
        subscriptions: state.subscriptions.map((s) =>
          s.id === action.payload.id ? { ...s, notifActive: !s.notifActive } : s
        ),
      };
    case 'SUBSCRIPTIONS_LOADED': {
      const prev = state.subscriptions;
      return {
        ...state,
        subscriptions: action.payload.map(s => {
          let id;
          if (s.mosqueeOsmId) {
            id = `osm_${s.mosqueeOsmId}`;
          } else {
            // mosqueeOsmId null : essayer de préserver l'id OSM déjà connu localement
            const existing = prev.find(p => p.apiId != null && String(p.apiId) === String(s.id));
            id = (existing?.id?.startsWith('osm_')) ? existing.id : `db_${s.mosqueeId}`;
          }
          return {
            id,
            mosqueeId: String(s.mosqueeId),
            apiId: s.id,
            nom: s.mosqueeNom ?? '',
            adresse: s.mosqueeAdresse ?? '',
            latitude: s.mosqueeLatitude,
            longitude: s.mosqueeLongitude,
            notifActive: s.notifActive,
          };
        }),
      };
    }
    case 'MOSQUES_SUPPRESS': {
      // payload = string[] of osmIds like "node_12345" or "way_67890"
      const suppressedSet = new Set(action.payload);
      const filtered = state.known.filter((m) => {
        // known mosque ids are like "osm_node_12345" — strip the leading "osm_" to match
        const osmKey = m.id?.startsWith('osm_') ? m.id.slice(4) : null;
        return osmKey == null || !suppressedSet.has(osmKey);
      });
      if (filtered.length === state.known.length) return state;
      return { ...state, known: filtered };
    }
    case 'AUTH_LOGOUT':
      return initialMosques;
    default:
      return state;
  }
}

const initialJanazas = { list: [] };

function parseApiDate(raw) {
  if (!raw) return null;
  // Force UTC: EF Core reads DateTime as Unspecified (no Z) — add Z if no timezone designator
  return new Date(/Z$|[+-]\d{2}:/.test(raw) ? raw : raw + 'Z');
}

function normalizeStatut(s) {
  if (s === 'AVenir' || s === 'a_venir') return 'a_venir';
  if (s === 'EnCours' || s === 'en_cours') return 'en_cours';
  if (s === 'Terminee' || s === 'terminee') return 'terminee';
  if (s === 'EnAttente' || s === 'en_attente') return 'en_attente';
  return 'a_venir';
}

function apiJanazaToLocal(j) {
  return {
    id: String(j.id),
    mosqueeId: String(j.mosqueeId),
    mosquee: j.mosqueeNom ?? '',
    adresse: j.mosqueeAdresse ?? '',
    latitude: j.mosqueeLatitude ?? null,
    longitude: j.mosqueeLongitude ?? null,
    utilisateurId: j.utilisateurId ?? null,
    dateHeure: parseApiDate(j.dateHeurePriere),
    utcOffsetMinutes: j.utcOffsetMinutes ?? 0,
    statut: normalizeStatut(j.statut),
    genre: j.genre ?? 'homme',
    nomDefunt: j.nomDefunt ?? '',
    estAnonyme: j.estAnonyme ?? false,
    commentaire: j.commentaire ?? '',
    paysEnterrement: j.paysEnterrement ?? null,
    villeEnterrement: j.villeEnterrement ?? null,
    anneeNaissance: j.anneeNaissance ?? null,
    anneeDeces: j.anneeDeces ?? null,
    declarantEmail: '',
  };
}

function janazasReducer(state = initialJanazas, action) {
  switch (action.type) {
    case 'JANAZA_ADD':
      return { ...state, list: [action.payload, ...state.list] };
    case 'JANAZAS_LOADED': {
      const fromApi = action.payload.map(apiJanazaToLocal);
      // Remplacement complet : les suppressions (web ou admin) sont immédiatement reflétées
      // JANAZA_ADD s'exécute après le POST réussi donc la prière est déjà en DB au prochain fetch
      return { ...state, list: fromApi };
    }
    case 'JANAZA_EXPIRE':
      return {
        ...state,
        list: state.list.filter((i) => {
          if (!i.dateHeure) return false;
          const wallClockMs = i.dateHeure instanceof Date ? i.dateHeure.getTime() : new Date(i.dateHeure).getTime();
          const offset = i.utcOffsetMinutes || (-new Date().getTimezoneOffset());
          const trueUtcMs = wallClockMs - offset * 60_000;
          return Date.now() - trueUtcMs < EXPIRY_MS;
        }),
      };
    case 'JANAZA_UPDATE': {
      const u = action.payload;
      return { ...state, list: state.list.map(j => String(j.id) === String(u.id) ? { ...j, ...apiJanazaToLocal(u), utcOffsetMinutes: u.utcOffsetMinutes ?? j.utcOffsetMinutes ?? 0 } : j) };
    }
    case 'JANAZA_DELETE':
      return { ...state, list: state.list.filter((i) => i.id !== action.payload.id) };
    case 'AUTH_LOGOUT':
      return { list: [] };
    default:
      return state;
  }
}

const initialMyDeclarations = { list: [] };

function toTs(dateHeure) {
  if (typeof dateHeure === 'number') return dateHeure;
  if (dateHeure instanceof Date) return dateHeure.getTime();
  if (typeof dateHeure === 'string') {
    const utc = /Z$|[+-]\d{2}:/.test(dateHeure) ? dateHeure : dateHeure + 'Z';
    return new Date(utc).getTime();
  }
  return 0;
}

function myDeclarationsReducer(state = initialMyDeclarations, action) {
  switch (action.type) {
    case 'JANAZA_ADD':
      return {
        ...state,
        list: [{ ...action.payload, dateHeure: toTs(action.payload.dateHeure) }, ...state.list],
      };
    case 'MY_DECLARATIONS_LOADED':
      return {
        ...state,
        list: action.payload.map(d => ({
          ...d,
          id: String(d.id),
          mosqueeId: d.mosqueeId ? String(d.mosqueeId) : null,
          dateHeure: toTs(d.dateHeurePriere ?? d.dateHeure),
          mosquee: d.mosqueeNom ?? d.mosquee ?? '',
          adresse: d.mosqueeAdresse ?? d.adresse ?? '',
          latitude: d.mosqueeLatitude ?? d.latitude ?? null,
          longitude: d.mosqueeLongitude ?? d.longitude ?? null,
          commentaire: d.commentaire ?? '',
          estAnonyme: d.estAnonyme ?? false,
          nomDefunt: d.nomDefunt ?? '',
          genre: d.genre ?? 'homme',
          paysEnterrement: d.paysEnterrement ?? null,
          villeEnterrement: d.villeEnterrement ?? null,
          anneeNaissance: d.anneeNaissance ?? null,
          anneeDeces: d.anneeDeces ?? null,
        })),
      };
    case 'JANAZA_UPDATE': {
      const u = action.payload;
      return {
        ...state,
        list: state.list.map(d => String(d.id) === String(u.id)
          ? {
              ...d,
              dateHeure: toTs(u.dateHeurePriere ?? u.dateHeure),
              nomDefunt: u.nomDefunt ?? '',
              estAnonyme: u.estAnonyme ?? false,
              genre: u.genre ?? 'homme',
              commentaire: u.commentaire ?? '',
              paysEnterrement: u.paysEnterrement !== undefined ? u.paysEnterrement : (d.paysEnterrement ?? null),
              villeEnterrement: u.villeEnterrement !== undefined ? u.villeEnterrement : (d.villeEnterrement ?? null),
              anneeNaissance: u.anneeNaissance !== undefined ? u.anneeNaissance : (d.anneeNaissance ?? null),
              anneeDeces: u.anneeDeces !== undefined ? u.anneeDeces : (d.anneeDeces ?? null),
            }
          : d
        ),
      };
    }
    case 'MY_DECLARATION_DELETE':
      return { ...state, list: state.list.filter((d) => String(d.id) !== String(action.payload.id)) };
    case 'MY_DECLARATIONS_EXPIRE': {
      const now = Date.now();
      return {
        ...state,
        list: state.list.filter((d) => now - toTs(d.dateHeure) < SIX_MONTHS_MS),
      };
    }
    case 'AUTH_LOGOUT':
      return initialMyDeclarations;
    default:
      return state;
  }
}

function appRefreshReducer(state = 0, action) {
  if (action.type === 'FORCE_DATA_REFRESH') return state + 1;
  return state;
}

function uiReducer(state = { openProfileHistorique: false, locationMode: 'gps' }, action) {
  switch (action.type) {
    case 'UI_OPEN_PROFILE_HISTORIQUE':
      return { ...state, openProfileHistorique: true };
    case 'UI_CLEAR_PROFILE_HISTORIQUE':
      return { ...state, openProfileHistorique: false };
    case 'SET_LOCATION_MODE':
      return { ...state, locationMode: action.payload };
    default:
      return state;
  }
}

function featuresReducer(state = { donationButtonVisible: true }, action) {
  switch (action.type) {
    case 'FEATURES_LOADED':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

export default combineReducers({
  auth: authReducer,
  mosques: mosquesReducer,
  janazas: janazasReducer,
  myDeclarations: myDeclarationsReducer,
  appRefresh: appRefreshReducer,
  ui: uiReducer,
  features: featuresReducer,
});
