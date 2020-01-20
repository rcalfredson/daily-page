class EncodeHelper {
  static htmlString(inputString) {
    return encodeURIComponent(inputString).replace(/'/g, '%27');
  }
}

export default EncodeHelper;
module.exports = EncodeHelper;
