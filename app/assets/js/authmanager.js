/**
 * AuthManager
 *
 * This module aims to abstract login procedures. Results from Mojang's REST api
 * are retrieved through our Mojang module. These results are processed and stored,
 * if applicable, in the config using the ConfigManager. All login procedures should
 * be made through this module.
 *
 * @module authmanager
 */
// Requirements
const ConfigManager = require("./configmanager");
const { LoggerUtil } = require("helios-core");
const { RestResponseStatus } = require("helios-core/common");
const {
  MojangRestAPI,
  MojangErrorCode,
} = require("helios-core/mojang");
const {
  MicrosoftAuth,
  MicrosoftErrorCode,
} = require("helios-core/microsoft");
const { AZURE_CLIENT_ID } = require("./ipcconstants");

const log = LoggerUtil.getLogger("AuthManager");

// Error messages
function microsoftErrorDisplayable(errorCode) {
  switch (errorCode) {
    case MicrosoftErrorCode.NO_PROFILE:
      return {
        title: 'No se encontró un perfil',
        desc: 'Inicia sesión en la web de minecraft.net con tu cuenta de Microsoft y vuelve a intentarlo.'
      }
    case MicrosoftErrorCode.NO_XBOX_ACCOUNT:
      return {
        title: 'No se encontró una cuenta de Xbox',
        desc: 'La cuenta de Microsoft que está intentando iniciar sesión no tiene una cuenta de Xbox vinculada a ella.'
      }
    case MicrosoftErrorCode.XBL_BANNED:
      return {
        title: 'Cuenta suspendida en Xbox Live',
        desc: 'La cuenta de Microsoft que está intentando iniciar sesión ha sido suspendida en Xbox Live.'
      }
    case MicrosoftErrorCode.UNDER_18:
      return {
        title: 'La cuenta es menor de 18 años',
        desc: 'La cuenta de Microsoft que está intentando iniciar sesión es menor de 18 años y no puede jugar Minecraft.'
      }
    case MicrosoftErrorCode.UNKNOWN:
      return {
        title: 'Error desconocido',
        desc: 'Se produjo un error desconocido al intentar iniciar sesión con Microsoft. Por favor, inténtelo de nuevo más tarde.'
      }
  }
}

function mojangErrorDisplayable(errorCode) {
  switch (errorCode) {
    case MojangErrorCode.ERROR_METHOD_NOT_ALLOWED:
      return {
        title: 'Método no permitido',
        desc: 'El método de autenticación no está permitido en este servidor.',
      }
    case MojangErrorCode.ERROR_NOT_FOUND:
      return {
        title: 'Cuenta no encontrada',
        desc: 'La cuenta de usuario no existe en Mojang.',
      }
    case MojangErrorCode.ERROR_USER_MIGRATED:
      return {
        title: 'Cuenta migrada',
        desc: 'La cuenta de usuario ha sido migrada a una nueva cuenta.',
      }
    case MojangErrorCode.ERROR_INVALID_CREDENTIALS:
      return {
        title: 'Credenciales inválidas',
        desc: 'La contraseña ingresada es incorrecta.',
      }
    case MojangErrorCode.ERROR_RATELIMIT:
      return {
        title: 'Limite de intentos alcanzado',
        desc: 'Se ha alcanzado el límite máximo de intentos de autenticación.',
      }
    case MojangErrorCode.ERROR_INVALID_TOKEN:
      return {
        title: 'Token de acceso inválido',
        desc: 'El token de acceso no es válido.',
      }
    case MojangErrorCode.ERROR_ACCESS_TOKEN_HAS_PROFILE:
      return {
        title: 'Token de acceso contiene perfil',
        desc: 'El token de acceso ya está asignado a un perfil de Minecraft.',
      }
    case MojangErrorCode.ERROR_CREDENTIALS_MISSING:
      return {
        title: 'Faltan credenciales',
        desc: 'No se proporcionaron credenciales para la autenticación.',
      }
    case MojangErrorCode.ERROR_INVALID_SALT_VERSION:
      return {
        title: 'Versión de sal de sesión inválida',
        desc: 'La versión de sal de sesión es incompatible.',
      }
    case MojangErrorCode.ERROR_UNSUPPORTED_MEDIA_TYPE:
      return {
        title: 'Tipo de contenido no soportado',
        desc: 'El tipo de contenido de la solicitud no es soportado.',
      }
    case MojangErrorCode.ERROR_GONE:
      return {
        title: 'Cuenta eliminada',
        desc: 'La cuenta de usuario ha sido eliminada de Mojang.',
      }
    case MojangErrorCode.ERROR_UNREACHABLE:
      return {
        title: 'Servidor no disponible',
        desc: 'El servidor de Mojang está temporalmente no disponible.',
      }
    case MojangErrorCode.ERROR_NOT_PAID:
      return {
        title: 'Juego no comprado',
        desc: 'No se ha comprado el juego y no se puede autenticar.',
      }
    case MojangErrorCode.UNKNOWN:
      return {
        title: 'Error desconocido',
        desc: 'Se produjo un error desconocido al intentar autenticar con Mojang.',
      }
    default:
      throw new Error(`Error desconocido: ${errorCode}`)
  }
}


// Functions

/**
 * Add a Mojang account. This will authenticate the given credentials with Mojang's
 * authserver. The resultant data will be stored as an auth account in the
 * configuration database.
 *
 * @param {string} username The account username (email if migrated).
 * @param {string} password The account password.
 * @returns {Promise.<Object>} Promise which resolves the resolved authenticated account object.
 */
exports.addMojangAccount = async function (username, password) {
  try {
    const response = await MojangRestAPI.authenticate(
      username,
      password,
      ConfigManager.getClientToken()
    );
    console.log(response);
    if (response.responseStatus === RestResponseStatus.SUCCESS) {
      const session = response.data;
      if (session.selectedProfile != null) {
        const ret = ConfigManager.addMojangAuthAccount(
          session.selectedProfile.id,
          session.accessToken,
          username,
          session.selectedProfile.name
        );
        if (ConfigManager.getClientToken() == null) {
          ConfigManager.setClientToken(session.clientToken);
        }
        ConfigManager.save();
        return ret;
      } else {
        return Promise.reject(
          mojangErrorDisplayable(MojangErrorCode.ERROR_NOT_PAID)
        );
      }
    } else {
      return Promise.reject(mojangErrorDisplayable(response.mojangErrorCode));
    }
  } catch (err) {
    log.error(err);
    return Promise.reject(mojangErrorDisplayable(MojangErrorCode.UNKNOWN));
  }
};

/**
 * Add a cracked account.
 * The resultant data will be stored as an auth account in the configuration database.
 *
 * @param {string} username The account username.
 * @returns {Object} The cracked account object.
 */
exports.addCrackedAccount = async function (username) {
  try {
    const ret = ConfigManager.addCrackedAccount(username);
    ConfigManager.save();
    return ret;
  } catch (err) {
    log.error(err);
    return;
  }
};

const AUTH_MODE = { FULL: 0, MS_REFRESH: 1, MC_REFRESH: 2 };

/**
 * Perform the full MS Auth flow in a given mode.
 *
 * AUTH_MODE.FULL = Full authorization for a new account.
 * AUTH_MODE.MS_REFRESH = Full refresh authorization.
 * AUTH_MODE.MC_REFRESH = Refresh of the MC token, reusing the MS token.
 *
 * @param {string} entryCode FULL-AuthCode. MS_REFRESH=refreshToken, MC_REFRESH=accessToken
 * @param {*} authMode The auth mode.
 * @returns An object with all auth data. AccessToken object will be null when mode is MC_REFRESH.
 */
async function fullMicrosoftAuthFlow(entryCode, authMode) {
  try {
    let accessTokenRaw;
    let accessToken;
    if (authMode !== AUTH_MODE.MC_REFRESH) {
      const accessTokenResponse = await MicrosoftAuth.getAccessToken(
        entryCode,
        authMode === AUTH_MODE.MS_REFRESH,
        AZURE_CLIENT_ID
      );
      if (accessTokenResponse.responseStatus === RestResponseStatus.ERROR) {
        return Promise.reject(
          microsoftErrorDisplayable(accessTokenResponse.microsoftErrorCode)
        );
      }
      accessToken = accessTokenResponse.data;
      accessTokenRaw = accessToken.access_token;
    } else {
      accessTokenRaw = entryCode;
    }

    const xblResponse = await MicrosoftAuth.getXBLToken(accessTokenRaw);
    if (xblResponse.responseStatus === RestResponseStatus.ERROR) {
      return Promise.reject(
        microsoftErrorDisplayable(xblResponse.microsoftErrorCode)
      );
    }
    const xstsResonse = await MicrosoftAuth.getXSTSToken(xblResponse.data);
    if (xstsResonse.responseStatus === RestResponseStatus.ERROR) {
      return Promise.reject(
        microsoftErrorDisplayable(xstsResonse.microsoftErrorCode)
      );
    }
    const mcTokenResponse = await MicrosoftAuth.getMCAccessToken(
      xstsResonse.data
    );
    if (mcTokenResponse.responseStatus === RestResponseStatus.ERROR) {
      return Promise.reject(
        microsoftErrorDisplayable(mcTokenResponse.microsoftErrorCode)
      );
    }
    const mcProfileResponse = await MicrosoftAuth.getMCProfile(
      mcTokenResponse.data.access_token
    );
    if (mcProfileResponse.responseStatus === RestResponseStatus.ERROR) {
      return Promise.reject(
        microsoftErrorDisplayable(mcProfileResponse.microsoftErrorCode)
      );
    }
    return {
      accessToken,
      accessTokenRaw,
      xbl: xblResponse.data,
      xsts: xstsResonse.data,
      mcToken: mcTokenResponse.data,
      mcProfile: mcProfileResponse.data,
    };
  } catch (err) {
    log.error(err);
    return Promise.reject(
      microsoftErrorDisplayable(MicrosoftErrorCode.UNKNOWN)
    );
  }
}

/**
 * Calculate the expiry date. Advance the expiry time by 10 seconds
 * to reduce the liklihood of working with an expired token.
 *
 * @param {number} nowMs Current time milliseconds.
 * @param {number} epiresInS Expires in (seconds)
 * @returns
 */
function calculateExpiryDate(nowMs, epiresInS) {
  return nowMs + (epiresInS - 10) * 1000;
}

/**
 * Add a Microsoft account. This will pass the provided auth code to Mojang's OAuth2.0 flow.
 * The resultant data will be stored as an auth account in the configuration database.
 *
 * @param {string} authCode The authCode obtained from microsoft.
 * @returns {Promise.<Object>} Promise which resolves the resolved authenticated account object.
 */
exports.addMicrosoftAccount = async function (authCode) {
  const fullAuth = await fullMicrosoftAuthFlow(authCode, AUTH_MODE.FULL);

  // Advance expiry by 10 seconds to avoid close calls.
  const now = new Date().getTime();

  const ret = ConfigManager.addMicrosoftAuthAccount(
    fullAuth.mcProfile.id,
    fullAuth.mcToken.access_token,
    fullAuth.mcProfile.name,
    calculateExpiryDate(now, fullAuth.mcToken.expires_in),
    fullAuth.accessToken.access_token,
    fullAuth.accessToken.refresh_token,
    calculateExpiryDate(now, fullAuth.accessToken.expires_in)
  );
  ConfigManager.save();

  return ret;
};

/**
 * Remove a Mojang account. This will invalidate the access token associated
 * with the account and then remove it from the database.
 *
 * @param {string} uuid The UUID of the account to be removed.
 * @returns {Promise.<void>} Promise which resolves to void when the action is complete.
 */
exports.removeMojangAccount = async function (uuid) {
  try {
    const authAcc = ConfigManager.getAuthAccount(uuid);
    const response = await MojangRestAPI.invalidate(
      authAcc.accessToken,
      ConfigManager.getClientToken()
    );
    if (response.responseStatus === RestResponseStatus.SUCCESS) {
      ConfigManager.removeAuthAccount(uuid);
      ConfigManager.save();
      return Promise.resolve();
    } else {
      log.error("Error al eliminar la cuenta", response.error);
      return Promise.reject(response.error);
    }
  } catch (err) {
    log.error("Error al eliminar la cuenta", err);
    return Promise.reject(err);
  }
};

/**
 * Remove a cracked account from the database.
 *
 * @param {string} uuid The UUID of the account to be removed.
 * @returns {Promise.<void>} Promise which resolves to void when the action is complete.
 */
exports.removeCrackedAccount = async function (uuid) {
  try {
    ConfigManager.removeAuthAccount(uuid);
    ConfigManager.save();
    return Promise.resolve();
  } catch (err) {
    log.error("Error al eliminar la cuenta", err);
    return Promise.reject(err);
  }
};

/**
 * Remove a Microsoft account. It is expected that the caller will invoke the OAuth logout
 * through the ipc renderer.
 *
 * @param {string} uuid The UUID of the account to be removed.
 * @returns {Promise.<void>} Promise which resolves to void when the action is complete.
 */
exports.removeMicrosoftAccount = async function (uuid) {
  try {
    ConfigManager.removeAuthAccount(uuid);
    ConfigManager.save();
    return Promise.resolve();
  } catch (err) {
    log.error("Error al eliminar la cuenta", err);
    return Promise.reject(err);
  }
};

/**
 * Validate the selected account with Mojang's authserver. If the account is not valid,
 * we will attempt to refresh the access token and update that value. If that fails, a
 * new login will be required.
 *
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
async function validateSelectedMojangAccount() {
  const current = ConfigManager.getSelectedAccount();
  const response = await MojangRestAPI.validate(
    current.accessToken,
    ConfigManager.getClientToken()
  );

  if (response.responseStatus === RestResponseStatus.SUCCESS) {
    const isValid = response.data;
    if (!isValid) {
      const refreshResponse = await MojangRestAPI.refresh(
        current.accessToken,
        ConfigManager.getClientToken()
      );
      if (refreshResponse.responseStatus === RestResponseStatus.SUCCESS) {
        const session = refreshResponse.data;
        ConfigManager.updateMojangAuthAccount(
          current.uuid,
          session.accessToken
        );
        ConfigManager.save();
      } else {
        log.error(
          "Error al validar el perfil seleccionado:",
          refreshResponse.error
        );
        log.info("El token de acceso a la cuenta no es válido.");
        return false;
      }
      log.info("Token de acceso a la cuenta validado.");
      return true;
    } else {
      log.info("Token de acceso a la cuenta validado.");
      return true;
    }
  }
}

/**
 * Validate the selected account with Microsoft's authserver. If the account is not valid,
 * we will attempt to refresh the access token and update that value. If that fails, a
 * new login will be required.
 *
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
async function validateSelectedMicrosoftAccount() {
  const current = ConfigManager.getSelectedAccount();
  const now = new Date().getTime();
  const mcExpiresAt = current.expiresAt;
  const mcExpired = now >= mcExpiresAt;

  if (!mcExpired) {
    return true;
  }

  // MC token expired. Check MS token.

  const msExpiresAt = current.microsoft.expires_at;
  const msExpired = now >= msExpiresAt;

  if (msExpired) {
    // MS expired, do full refresh.
    try {
      const res = await fullMicrosoftAuthFlow(
        current.microsoft.refresh_token,
        AUTH_MODE.MS_REFRESH
      );

      ConfigManager.updateMicrosoftAuthAccount(
        current.uuid,
        res.mcToken.access_token,
        res.accessToken.access_token,
        res.accessToken.refresh_token,
        calculateExpiryDate(now, res.accessToken.expires_in),
        calculateExpiryDate(now, res.mcToken.expires_in)
      );
      ConfigManager.save();
      return true;
    } catch (err) {
      return false;
    }
  } else {
    // Only MC expired, use existing MS token.
    try {
      const res = await fullMicrosoftAuthFlow(
        current.microsoft.access_token,
        AUTH_MODE.MC_REFRESH
      );

      ConfigManager.updateMicrosoftAuthAccount(
        current.uuid,
        res.mcToken.access_token,
        current.microsoft.access_token,
        current.microsoft.refresh_token,
        current.microsoft.expires_at,
        calculateExpiryDate(now, res.mcToken.expires_in)
      );
      ConfigManager.save();
      return true;
    } catch (err) {
      return false;
    }
  }
}

/**
 * Validate the selected auth account.
 *
 * @returns {Promise.<boolean>} Promise which resolves to true if the access token is valid,
 * otherwise false.
 */
exports.validateSelected = async function () {
  const current = ConfigManager.getSelectedAccount();

  if (current.type === "microsoft") {
    return await validateSelectedMicrosoftAccount();
  } else {
    return await validateSelectedMojangAccount();
  }
};
