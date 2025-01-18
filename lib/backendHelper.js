/* eslint-disable no-console */
class BackendHelper {
  static getPage(date = null, options = null) {
    return BackendHelper.getInfo('page', date, options);
  }

  static getPageDatesByYearAndMonth(year, month) {
    return BackendHelper.getInfo('pageDates', `${year}/${month}`);
  }

  static getPageMonthYearCombos() {
    return BackendHelper.getInfo('pageDates');
  }

  static syncPage(content) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const url = `${backendURL}/page/${room}`;
      request.open('POST', url);
      request.setRequestHeader('Content-Type', 'application/json');
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send(JSON.stringify({ content }));
    });
  }

  static addPeer(id) {
    BackendHelper.modifyPeer(id, 'POST');
  }

  static getPeers() {
    return BackendHelper.getInfo('peers', null, {
      room,
    }, true);
  }

  static getInfo(type, param, options = null, optionsOnly = false) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      let url = `${backendURL}/${type}`;
      if (!optionsOnly) {
        url += `${room ? `/${room}` : ''}${param ? `/${param}` : ''}`;
      }
      url += BackendHelper.serialize(options);
      request.open('GET', url);
      BackendHelper.setHandlersForPromise(request, resolve, reject);
      request.send();
    });
  }

  static removePeer(id) {
    BackendHelper.modifyPeer(id, 'DELETE');
  }

  static modifyPeer(id, method) {
    const request = new XMLHttpRequest();
    const url = `${backendURL}/peers/${room}/${id}`;
    request.open(method, url);
    BackendHelper.setHandlers(request);
    request.send();
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

  static serialize(obj) {
    if (!obj) {
      return '';
    }
    const str = [];
    Object.keys(obj).forEach((key) => {
      str.push(`${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`);
    });
    return `?${str.join('&')}`;
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
