const loginOptionsCancelContainer = document.getElementById(
  "loginOptionCancelContainer"
);
const loginOptionMicrosoft = document.getElementById("loginOptionMicrosoft");
const loginOptionMojang = document.getElementById("loginOptionMojang");
const loginOptionCracked = document.getElementById("loginOptionCracked");
const loginPremiumModeWarnContainer = document.getElementById(
  "loginPremiumModeWarnContainer"
);
const loginOptionsCancelButton = document.getElementById(
  "loginOptionCancelButton"
);

let loginOptionsCancellable = false;

let loginOptionsViewOnLoginSuccess;
let loginOptionsViewOnLoginCancel;
let loginOptionsViewOnCancel;
let loginOptionsViewCancelHandler;

function loginOptionsCancelEnabled(val) {
  if (val) {
    $(loginOptionsCancelContainer).show();
  } else {
    $(loginOptionsCancelContainer).hide();
  }
}

async function premiumMode() {
  const d = await DistroAPI.getDistribution();
  return d.rawDistribution.premiumMode;
}

premiumMode().then((enabled) => {
  if (enabled) {
    $(loginPremiumModeWarnContainer).show();
    loginOptionCracked.disabled = true;
    disableAddCrackedAccount();
  }
});

loginOptionMicrosoft.onclick = (e) => {
  switchView(getCurrentView(), VIEWS.waiting, 500, 500, () => {
    ipcRenderer.send(
      MSFT_OPCODE.OPEN_LOGIN,
      loginOptionsViewOnLoginSuccess,
      loginOptionsViewOnLoginCancel
    );
  });
};

loginOptionMojang.onclick = (e) => {
  switchView(getCurrentView(), VIEWS.login, 500, 500, () => {
    loginViewOnSuccess = loginOptionsViewOnLoginSuccess;
    loginViewOnCancel = loginOptionsViewOnLoginCancel;
    loginCancelEnabled(true);
  });
};

loginOptionCracked.onclick = (e) => {
  switchView(getCurrentView(), VIEWS.crackedLogin, 500, 500, () => {
    loginViewOnSuccess = loginOptionsViewOnLoginSuccess;
    loginViewOnCancel = loginOptionsViewOnLoginCancel;
    cLoginCancelEnabled(true);
  });
};

loginOptionsCancelButton.onclick = (e) => {
  switchView(getCurrentView(), loginOptionsViewOnCancel, 500, 500, () => {
    // Clear login values (Mojang login)
    // No cleanup needed for Microsoft.
    loginUsername.value = "";
    loginPassword.value = "";
    if (loginOptionsViewCancelHandler != null) {
      loginOptionsViewCancelHandler();
      loginOptionsViewCancelHandler = null;
    }
  });
};
