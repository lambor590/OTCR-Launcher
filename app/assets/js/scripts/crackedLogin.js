/**
 * Script for login.ejs
 */
const validName = /^[A-Za-z0-9_]{3,16}$/;

// Login Elements
const cLoginCancelContainer = document.getElementById("cLoginCancelContainer");
const cLoginCancelButton = document.getElementById("cLoginCancelButton");
const cLoginEmailError = document.getElementById("cLoginEmailError");
const cCheckmarkContainer = document.getElementById("cCheckmarkContainer");
const cLoginRememberOption = document.getElementById("cLoginRememberOption");
const crackedLoginButton = document.getElementById("crackedLoginButton");
const crackedLoginUsername = document.getElementById("crackedLoginUsername");
const cLoginForm = document.getElementById("cLoginForm");

/**
 * Show a login error.
 *
 * @param {HTMLElement} element The element on which to display the error.
 * @param {string} value The error text.
 */
function showError(element, value) {
  element.innerHTML = value;
  element.style.opacity = 1;
}

/**
 * Shake a login error to add emphasis.
 *
 * @param {HTMLElement} element The element to shake.
 */
function shakeError(element) {
  if (element.style.opacity == 1) {
    element.classList.remove("shake");
    void element.offsetWidth;
    element.classList.add("shake");
  }
}

/**
 * Validate that an email field is neither empty nor invalid.
 *
 * @param {string} value The email value.
 */
function validateUsername(value) {
  if (value) {
    if (!validName.test(value)) {
      showError(cLoginEmailError, Lang.queryJS("login.error.invalidValue"));
      cLoginDisabled(true);
    } else {
      cLoginEmailError.style.opacity = 0;
      cLoginDisabled(false);
    }
  } else {
    showError(cLoginEmailError, Lang.queryJS("login.error.requiredValue"));
    cLoginDisabled(true);
  }
}

crackedLoginUsername.addEventListener("focusout", (e) => {
  validateUsername(e.target.value);
  shakeError(cLoginEmailError);
});
crackedLoginUsername.addEventListener("input", (e) => {
  validateUsername(e.target.value);
});

/**
 * Enable or disable the login button.
 *
 * @param {boolean} v True to enable, false to disable.
 */
function cLoginDisabled(v) {
  if (crackedLoginButton.disabled !== v) {
    crackedLoginButton.disabled = v;
  }
}

/**
 * Enable or disable login form.
 *
 * @param {boolean} v True to enable, false to disable.
 */
function cFormDisabled(v) {
  cLoginDisabled(v);
  cLoginCancelButton.disabled = v;
  crackedLoginUsername.disabled = v;
  if (v) {
    cCheckmarkContainer.setAttribute("disabled", v);
  } else {
    cCheckmarkContainer.removeAttribute("disabled");
  }
  cLoginRememberOption.disabled = v;
}

let cLoginViewOnSuccess = VIEWS.landing;
let cLoginViewOnCancel = VIEWS.loginOptions;
let cLoginViewCancelHandler;

function cLoginCancelEnabled(val) {
  if (val) {
    $(cLoginCancelContainer).show();
  } else {
    $(cLoginCancelContainer).hide();
  }
}

cLoginCancelButton.onclick = (e) => {
  switchView(getCurrentView(), cLoginViewOnCancel, 500, 500, () => {
    crackedLoginUsername.value = "";
    cLoginCancelEnabled(false);
    if (cLoginViewCancelHandler != null) {
      loginViewCancelHandler();
      cLoginViewCancelHandler = null;
    }
  });
};

// Disable default form behavior.
cLoginForm.onsubmit = () => {
  return false;
};

crackedLoginButton.addEventListener("click", () => {
  cFormDisabled(true);
  AuthManager.addCrackedAccount(crackedLoginUsername.value)
    .then((value) => {
      updateSelectedAccount(value);
      switchView(VIEWS.crackedLogin, cLoginViewOnSuccess, 500, 500, async () => {
        // Temporary workaround
        if (cLoginViewOnSuccess === VIEWS.settings) {
          await prepareSettings();
        }
        cLoginViewOnSuccess = VIEWS.landing; // Reset this for good measure.
        cLoginCancelEnabled(false); // Reset this for good measure.
        cLoginViewCancelHandler = null; // Reset this for good measure.
        crackedLoginUsername.value = "";
        cFormDisabled(false);
        cLoginDisabled(true);
      });
    })
    .catch((displayableError) => {
      let actualDisplayableError;
      if (isDisplayableError(displayableError)) {
        msftLoginLogger.error("Error al iniciar sesión.", displayableError);
        actualDisplayableError = displayableError;
      } else {
        // Uh oh.
        msftLoginLogger.error(
          "Error no controlado durante el inicio de sesión.",
          displayableError
        );
        actualDisplayableError = {
          title: "Error desconocido durante el inicio de sesión",
          desc: "Un error desconocido a ocurrido. Consulte la consola para obtener más detalles.",
        };
      }

      setOverlayContent(
        actualDisplayableError.title,
        actualDisplayableError.desc,
        Lang.queryJS("login.tryAgain")
      );
      setOverlayHandler(() => {
        formDisabled(false);
        toggleOverlay(false);
      });
      toggleOverlay(true);
    });
});
