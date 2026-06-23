import { combineReducers } from 'redux';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
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
    case 'SUBSCRIPTIONS_LOADED':
      return {
        ...state,
        subscriptions: action.payload.map(s => ({
          id: s.mosqueeOsmId ? `osm_${s.mosqueeOsmId}` : `db_${s.mosqueeId}`,
          mosqueeId: String(s.mosqueeId),
          apiId: s.id,
          nom: s.mosqueeNom ?? '',
          adresse: s.mosqueeAdresse ?? '',
          latitude: s.mosqueeLatitude,
          longitude: s.mosqueeLongitude,
          notifActive: s.notifActive,
        })),
      };
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
    statut: j.statut ?? 'AVenir',
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
          const t = i.dateHeure instanceof Date ? i.dateHeure.getTime() : new Date(i.dateHeure).getTime();
          return Date.now() - t < TWO_HOURS_MS;
        }),
      };
    case 'JANAZA_UPDATE': {
      const u = action.payload;
      return { ...state, list: state.list.map(j => String(j.id) === String(u.id) ? { ...j, ...apiJanazaToLocal(u) } : j) };
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
          dateHeure: toTs(d.dateHeurePriere ?? d.dateHeure),
          mosquee: d.mosqueeNom ?? d.mosquee ?? '',
          adresse: d.mosqueeAdresse ?? d.adresse ?? '',
          estAnonyme: d.estAnonyme ?? false,
          nomDefunt: d.nomDefunt ?? '',
          genre: d.genre ?? 'homme',
        })),
      };
    case 'JANAZA_UPDATE': {
      const u = action.payload;
      return {
        ...state,
        list: state.list.map(d => String(d.id) === String(u.id)
          ? { ...d, dateHeure: toTs(u.dateHeurePriere ?? u.dateHeure), nomDefunt: u.nomDefunt ?? '', estAnonyme: u.estAnonyme ?? false, genre: u.genre ?? 'homme', commentaire: u.commentaire ?? '' }
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

export default combineReducers({
  auth: authReducer,
  mosques: mosquesReducer,
  janazas: janazasReducer,
  myDeclarations: myDeclarationsReducer,
  appRefresh: appRefreshReducer,
});
