/* eslint-disable no-console */
class BackendHelper {
  /**
   * Fetch the full block details (metadata + content).
   * @param {string} blockId - The block ID.
   * @returns {Promise<Object>} - The block data.
   */
  static async getBlock(blockId) {
    return BackendHelper._fetchJSON(`api/v1/blocks/${blockId}`);
  }

  /**
   * Updates the block **content**.
   * @param {string} blockId - The block ID.
   * @param {string} content - The updated block content.
   * @returns {Promise<void>}
   */
  static async syncBlockContent(blockId, content) {
    return BackendHelper._sendJSON(`api/v1/blocks/${blockId}/content`, 'POST', { content });
  }

  /**
   * Updates the block **metadata** (title, description, tags).
   * Requires authentication or an edit token.
   * @param {string} blockId - The block ID.
   * @param {Object} metadata - Object containing title, description, and/or tags.
   * @returns {Promise<void>}
   */
  static async updateBlockMetadata(blockId, metadata) {
    return BackendHelper._sendJSON(`api/v1/blocks/${blockId}/metadata`, 'POST', metadata);
  }

  /**
   * Deletes a block (requires authentication or edit token).
   * @param {string} blockId - The block ID.
   * @returns {Promise<void>}
   */
  static async deleteBlock(blockId) {
    return BackendHelper._sendJSON(`api/v1/blocks/${blockId}`, 'DELETE');
  }

  /**
   * Fetches all active peer IDs for a block.
   * @param {string} blockId - The block ID.
   * @returns {Promise<string[]>} - An array of peer IDs.
   */
  static async getPeers(blockId) {
    console.log('getting peers')
    return BackendHelper._fetchJSON(`api/v1/blocks/${blockId}/peers`);
  }

  /**
   * Adds a peer to a block.
   * @param {string} blockId - The block ID.
   * @param {string} peerId - The peer's unique identifier.
   * @param {string} roomId - The room ID (required in request body).
   * @returns {Promise<void>}
   */
  static async addPeer(blockId, peerId, roomId) {
    if (!roomId) {
      console.warn(`addPeer called without a roomId (block: ${blockId}, peer: ${peerId})`);
      return; // Exit early if roomId is missing
    }
    console.log('trying to add a peer');
    return BackendHelper._sendJSON(`api/v1/blocks/${blockId}/peers/${peerId}`, 'POST', { room_id: roomId });
  }

  /**
   * Removes a peer from a block.
   * @param {string} blockId - The block ID.
   * @param {string} peerId - The peer's unique identifier.
   * @returns {Promise<void>}
   */
  static async removePeer(blockId, peerId) {
    return BackendHelper._sendJSON(`api/v1/blocks/${blockId}/peers/${peerId}`, 'DELETE');
  }

  /** 🌍 Helper Methods **/

  /**
   * Fetch helper to GET JSON from API.
   * @param {string} endpoint - API endpoint.
   * @returns {Promise<any>}
   */
  static async _fetchJSON(endpoint) {
    try {
      const response = await fetch(`${backendURL}/${endpoint}`);
      if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
      return response.status === 204 ? null : response.json(); // Handle empty response
    } catch (error) {
      console.error(`❌ BackendHelper Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send helper to POST/DELETE JSON to API.
   * @param {string} endpoint - API endpoint.
   * @param {string} method - HTTP method ('POST' or 'DELETE').
   * @param {Object} [body] - Request body (optional for DELETE).
   * @returns {Promise<void>}
   */
  static async _sendJSON(endpoint, method, body = null) {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null
      };
      const response = await fetch(`${backendURL}/${endpoint}`, options);
      if (!response.ok) throw new Error(`Failed to ${method} ${endpoint}`);
    } catch (error) {
      console.error(`❌ BackendHelper Error: ${error.message}`);
      throw error;
    }
  }
}

export default BackendHelper;
