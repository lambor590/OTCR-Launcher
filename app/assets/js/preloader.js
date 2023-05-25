const { ipcRenderer } = require("electron");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");

const ConfigManager = require("./configmanager");
const { DistroAPI } = require("./distromanager");
const LangLoader = require("./langloader");
const { LoggerUtil } = require("helios-core");
const { HeliosDistribution } = require("helios-core/common");

const logger = LoggerUtil.getLogger("Preloader");

logger.info("Cargando..");

ConfigManager.load();

DistroAPI["commonDir"] = ConfigManager.getCommonDirectory();
DistroAPI["instanceDir"] = ConfigManager.getInstanceDirectory();

// Load Strings
LangLoader.loadLanguage("es_ES");

/**
 *
 * @param {HeliosDistribution} data
 */
function onDistroLoad(data) {
  if (data != null) {
    // Resolve the selected server if its value has yet to be set.
    if (
      ConfigManager.getSelectedServer() == null ||
      data.getServerById(ConfigManager.getSelectedServer()) == null
    ) {
      logger.info("Determinando el servidor seleccionado por defecto...");
      ConfigManager.setSelectedServer(data.getMainServer().rawServer.id);
      ConfigManager.save();
    }
  }
  ipcRenderer.send("distributionIndexDone", data != null);
}

// Ensure Distribution is downloaded and cached.
DistroAPI.getDistribution()
  .then((heliosDistro) => {
    logger.info("Índice de distribución cargado.");

    onDistroLoad(heliosDistro);
  })
  .catch((err) => {
    logger.info("No se pudo cargar una versión anterior del índice de distribución.");
    logger.info("La aplicación no puede ejecutarse.");
    logger.error(err);

    onDistroLoad(null);
  });

// Clean up temp dir incase previous launches ended unexpectedly.
fs.remove(
  path.join(os.tmpdir(), ConfigManager.getTempNativeFolder()),
  (err) => {
    if (err) {
      logger.warn("Error al limpiar el directorio de nativos", err);
    } else {
      logger.info("Directorio de nativos limpio.");
    }
  }
);
