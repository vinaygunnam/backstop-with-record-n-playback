const fs = require("fs");
const path = require("path");
const {
  paths: { data_recordings, bitmaps_reference }
} = require("../backstop.json");

const recordingsFolderPath = path.resolve(__dirname, "..", data_recordings);
const bitmapsFolderPath = path.resolve(__dirname, "..", bitmaps_reference);

// create a folder to store recordings if it does not exist
(() => {
  if (fs.existsSync(recordingsFolderPath)) return;

  fs.mkdirSync(recordingsFolderPath);
})();

async function reset() {
  await require("del")([bitmapsFolderPath, recordingsFolderPath]);
}

const recordingMap = {};

function getPathToScenarioRecording(scenarioLabel) {
  if (!scenarioLabel) return null;
  return path.resolve(
    __dirname,
    "..",
    `${data_recordings}/${scenarioLabel}.json`
  );
}

function loadScenario(scenarioLabel) {
  const recordingPath = getPathToScenarioRecording(scenarioLabel);

  if (!recordingMap[scenarioLabel]) {
    const stubText = fs.existsSync(recordingPath)
      ? fs.readFileSync(recordingPath)
      : null;

    recordingMap[scenarioLabel] = {
      fileWritePromise: Promise.resolve(),
      recording: (stubText && JSON.parse(stubText)) || {}
    };
  }
}

function record(scenarioLabel, url, method, responseStub) {
  if (!scenarioLabel) return;
  if (!url || !method) return;

  loadScenario(scenarioLabel);

  const { recording } = recordingMap[scenarioLabel];

  // do not overwrite
  if (recording[url] && recording[url][method]) return;

  recording[url] = recording[url] || {};
  recording[url][method] = responseStub;

  const { fileWritePromise } = recordingMap[scenarioLabel];
  recordingMap[scenarioLabel].fileWritePromise = fileWritePromise.then(() => {
    fs.writeFile(
      getPathToScenarioRecording(scenarioLabel),
      JSON.stringify(recording, null, 2),
      err => {
        if (!err) return;
        console.error(`Error writing dump to ${filePath}. Detail: ${err}`);
      }
    );
  });
}

function playback(scenarioLabel, url, method) {
  loadScenario(scenarioLabel);

  const recording = recordingMap[scenarioLabel].recording;
  if (!recording) return null;
  if (!url || !method) return null;

  if (!recording[url]) return null;
  return recording[url][method];
}

module.exports = {
  record,
  playback,
  reset
};
