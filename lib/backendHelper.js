/* eslint-disable no-console */
class BackendHelper {
  constuctor(request = new XMLHttpRequest()) {
    this.request = request;
  }

  syncPage(content) {
    this.request = new XMLHttpRequest();
    const url = `${backendURL}/updatePage`;
    this.request.open('POST', url);
    this.request.setRequestHeader('Content-Type', 'application/json');
    this.setAuthorization();
    this.setHandlers();
    this.request.send(JSON.stringify({ content }));
  }

  addPeer(id) {
    this.modifyPeer(id, 'POST');
  }

  getPeers() {
    return new Promise((resolve, reject) => {
      this.request = new XMLHttpRequest();
      const url = `${backendURL}/peers`;
      this.request.open('GET', url);
      this.setAuthorization();
      this.setHandlers(() => resolve(JSON.parse(this.request.response)),
        () => reject(new Error(this.request.status)));
      this.request.send();
    });
  }

  removePeer(id) {
    this.modifyPeer(id, 'DELETE');
  }

  modifyPeer(id, method) {
    this.request = new XMLHttpRequest();
    const url = `${backendURL}/peers/${id}`;
    this.request.open(method, url);
    this.setAuthorization();
    this.setHandlers();
    this.request.send();
  }

  setAuthorization() {
    this.request.setRequestHeader('Authorization', sessionID);
  }

  setHandlers(successHandler = () => this.handleSuccess(), failHandler = () => this.handleError()) {
    this.request.onload = () => this.handleLoadedRequest(successHandler, failHandler);
    this.request.onerror = () => this.handleError();
  }

  handleSuccess() {
    console.log(this.request.statusText);
  }

  handleError() {
    console.error(this.request.statusText);
  }

  handleLoadedRequest(successHandler, failHandler) {
    if (this.request.readyState === 4) {
      if (this.request.status === 200) {
        successHandler();
      } else {
        failHandler();
      }
    }
  }
}

export default BackendHelper;
