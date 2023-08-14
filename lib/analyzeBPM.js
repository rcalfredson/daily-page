import "core-js/stable";
import RealTimeBPMAnalyzer from 'realtime-bpm-analyzer';

function indexOfMax(arr) {
  if (arr.length === 0) {
      return -1;
  }

  var max = arr[0];
  var maxIndex = 0;

  for (var i = 1; i < arr.length; i++) {
      if (arr[i] > max) {
          maxIndex = i;
          max = arr[i];
      }
  }

  return maxIndex;
}

class BeatAnalyzer {
  static findBeat(audioElement, bpmCommon) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaElementSource(audioElement);
    const scriptProcessorNode = audioContext.createScriptProcessor(4096, 1, 1);
    scriptProcessorNode.connect(audioContext.destination);
    source.connect(scriptProcessorNode);
    source.connect(audioContext.destination);

    const onAudioProcess = new RealTimeBPMAnalyzer({
      scriptNode: {
          bufferSize: 4096,
          numberOfInputChannels: 1,
          numberOfOutputChannels: 1
      },
      pushTime: 2000,
      pushCallback: (err, bpm) => {
          if (bpm === undefined) {return;}
          if (bpmCommon.result === undefined) {
            bpmCommon.result = bpm[indexOfMax(bpm.map(res => res.count))].tempo;
          } else {
              bpmCommon.result = 0.5 * (bpmCommon.result + bpm[indexOfMax(bpm.map(res => res.count))].tempo);
          }
      }
  });
  // Attach realTime function to audioprocess event.inputBuffer (AudioBuffer)
  scriptProcessorNode.onaudioprocess = (e) => {
      onAudioProcess.analyze(e);
  };
  }

  static markBeat(bpm, beatMarkTracker) {
    document.getElementById('beat-marker').innerText = '🥁'
      setTimeout(() => {
        document.getElementById('beat-marker').innerText = '';
      }, 300)
      const newBeatTime = Date.now();
      beatMarkTracker.lastBeat = newBeatTime;
  }
}

$(document).ready(async() => {
    var audioPlayer = document.getElementById('audio-player');
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var analyser = audioCtx.createAnalyser();
    var source = audioCtx.createMediaElementSource(audioPlayer);
    source.connect(analyser);
    analyser.fftSize = 2048;
    var bufferLength = analyser.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);
    setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);
    }, 17);
    let bpmCommon = {'result': undefined};
    let beatMarkTracker = {'lastBeat': undefined};
    let offsetModulo;
    let printBeatIndicator;
    let timeOffset = 0;
    audioPlayer.crossOrigin = 'anonymous';
    BeatAnalyzer.findBeat(audioPlayer, bpmCommon);
    setInterval(async () => {
        if (bpmCommon === undefined || bpmCommon.result === undefined) {return;}
        var calcStart = Date.now();
        var sampleFreq = 100;
        var sampleDuration = 3000;
        var myTotals = [];
        for (let index = 0; index < sampleDuration / sampleFreq; index++) {
          var startTime = Date.now()
          var myTot = 0.0;
          dataArray.forEach(piece => {
            myTot += Math.abs(piece);
          });
          myTotals.push(myTot);
          await new Promise(r => setTimeout(r, sampleFreq - (Date.now() - startTime)));
        }
        let index = indexOfMax(myTotals);
        let newTimeOffset = sampleFreq * index;
        let newModulo = newTimeOffset / 1000 % (60 / bpmCommon.result);
        if (offsetModulo === undefined || newModulo < offsetModulo) {
          offsetModulo = newModulo;
          timeOffset = newTimeOffset;
        setTimeout(() => {
        setTimeout(() => {
            BeatAnalyzer.markBeat(bpmCommon.result, beatMarkTracker);
            if (printBeatIndicator !== undefined) {
            clearInterval(printBeatIndicator);
            }
            printBeatIndicator = setInterval(() => {
            BeatAnalyzer.markBeat(bpmCommon.result, beatMarkTracker);
            }, 1000 * 60 / bpmCommon.result);
        }, timeOffset)
        }, 4000 - (Date.now() - calcStart));
    }
      }, 12000);
});
export default BeatAnalyzer;
