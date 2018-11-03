/* eslint-disable no-console */
class BackendHelper {
  static getPage() {
    return BackendHelper.getInfo('page');
  }

  static syncPage(content) {
    const request = new XMLHttpRequest();
    const url = `${backendURL}/page`;
    request.open('POST', url);
    request.setRequestHeader('Content-Type', 'application/json');
    BackendHelper.setAuthorization(request);
    BackendHelper.setHandlers(request);
    request.send(JSON.stringify({ content }));
  }

  static addPeer(id) {
    BackendHelper.modifyPeer(id, 'POST');
  }

  static getPeers() {
    return BackendHelper.getInfo('peers');
  }

  static getInfo(type) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/api/v1/${type}`;
      request.open('GET', url);
      BackendHelper.setAuthorization(request);
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  static removePeer(id) {
    BackendHelper.modifyPeer(id, 'DELETE');
  }

  static modifyPeer(id, method) {
    const request = new XMLHttpRequest();
    const url = `${backendURL}/peers/${id}`;
    request.open(method, url);
    BackendHelper.setAuthorization(request);
    BackendHelper.setHandlers(request);
    request.send();
  }

  static setAuthorization(request) {
    request.setRequestHeader('Authorization', sessionID);
  }

  static setHandlers(request, successHandler = BackendHelper.handleSuccess,
    failHandler = BackendHelper.handleError) {
    request.onload = () => BackendHelper.handleLoadedRequest(request,
      () => successHandler(request), () => failHandler(request));
    request.onerror = () => BackendHelper.handleError(request);
  }

  static setHandlersForPromise(request, resolve, reject) {
    BackendHelper.setHandlers(request, () => resolve(JSON.parse(request.response)),
      () => reject(new Error(request.response)));
  }

  static handleSuccess(request) {
    console.log(request.statusText);
  }

  static handleError(request) {
    console.error(request.statusText);
  }

  static handleLoadedRequest(request, successHandler, failHandler) {
    if (request.readyState === 4) {
      if (request.status === 200) {
        successHandler(request);
      } else {
        failHandler(request);
      }
    }
  }
}

export default BackendHelper;
