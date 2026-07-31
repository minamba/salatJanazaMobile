import apiClient from '../lib/api/apiClient';

export function refreshAllData(dispatch, userId) {
  dispatch({ type: 'FORCE_DATA_REFRESH' });
  const requests = [
    apiClient.get('/api/prierejanaza/upcoming')
      .then(res => dispatch({ type: 'JANAZAS_LOADED', payload: res.data })),
  ];
  if (userId) {
    requests.push(
      apiClient.get(`/api/prierejanaza/utilisateur/${userId}`)
        .then(res => dispatch({ type: 'MY_DECLARATIONS_LOADED', payload: res.data }))
    );
    requests.push(
      apiClient.get(`/api/abonnement/utilisateur/${userId}`)
        .then(res => dispatch({ type: 'SUBSCRIPTIONS_LOADED', payload: res.data }))
    );
  }
  return Promise.all(requests).catch(() => {});
}
