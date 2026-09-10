// Centralized translations for the login/signup UI — ONE dictionary, no
// scattered per-string language conditionals anywhere else in the app.
// Hindi = proper Devanagari; Hinglish = the same meaning in Latin-script
// Hindi. Technical identifiers (ABHA ID, Doctor ID, Care Crew) are never
// translated, matching how the rest of the app already mixes English
// product/technical terms into Hindi/Hinglish text.
(function () {
  const STORAGE_KEY = "carecrew-lang";

  const translations = {
    en: {
      brand_name: "Care Crew",
      hero_eyebrow: "AI-assisted care, for every OPD & PHC",
      hero_tagline: "Better conversations. Better histories. Better care.",
      hero_tagline_sub: "Care Crew helps you describe what you're feeling in your own words, so your doctor starts every visit already informed.",
      welcome_login: "Welcome back",
      welcome_register: "Create your account",
      subtitle_login: "Sign in to continue to Care Crew.",
      subtitle_register: "Join Care Crew to get started.",
      role_patient: "Patient",
      role_doctor: "Doctor",
      label_abha: "ABHA ID",
      label_doctor_id: "Doctor ID",
      label_name: "Full Name",
      label_phone: "Phone",
      label_email_optional: "Email (optional)",
      label_password: "Password",
      label_confirm_password: "Confirm Password",
      label_department: "Department",
      label_specialty: "Specialty",
      placeholder_abha: "Enter your ABHA ID",
      placeholder_doctor_id: "Enter your Doctor ID",
      placeholder_name: "Your full name",
      placeholder_phone: "10-digit mobile number",
      placeholder_email: "you@example.com",
      placeholder_password: "Enter your password",
      placeholder_confirm_password: "Re-enter your password",
      placeholder_department: "e.g. Cardiology",
      placeholder_specialty: "e.g. Interventional Cardiologist",
      btn_login: "Log In",
      btn_login_loading: "Signing in...",
      btn_register: "Create Account",
      btn_register_loading: "Creating account...",
      toggle_to_register_text: "New here?",
      toggle_to_register_link: "Create an account",
      toggle_to_login_text: "Already have an account?",
      toggle_to_login_link: "Log in instead",
      back_to_home: "← Back to home",
      show_password: "Show password",
      hide_password: "Hide password",
      register_success_title: "Account created!",
      register_success_body: "Your account has been created. Please log in to continue.",
      err_name_required: "Please enter your name",
      err_abha_required: "ABHA ID is required",
      err_doctor_id_required: "Doctor ID is required",
      err_password_required: "Please enter your password",
      err_password_length: "Password must be at least 6 characters",
      err_confirm_mismatch: "Passwords do not match",
      err_email_invalid: "Please enter a valid email address",
      err_network: "Network error — please check your connection and try again.",
      err_generic: "Something went wrong. Please try again.",
      err_abha_taken: "This ABHA ID is already registered",
      err_doctor_id_taken: "This Doctor ID is already registered",
      err_email_taken: "This email is already registered",
      err_invalid_credentials: "Invalid ID or password",
      err_wrong_role: "This account is registered under the other role — switch the toggle above and try again.",

      nav_home: "Home",
      nav_symptom_check: "Symptom Check & Book Appointment",
      nav_case_sheet: "Case Sheet",
      nav_appointment: "Book Appointment",
      nav_diagnosis: "Diagnosis",
      nav_previous_diagnosis: "Previous Diagnosis",
      nav_current_diagnosis: "Current Diagnosis",
      nav_dietary: "Dietary",
      nav_profile: "Profile",
      workflow_step_1: "Symptom Check",
      workflow_step_2: "Review Case Sheet",
      workflow_step_3: "Book Appointment",
      workflow_transition_title: "Your symptom check is complete.",
      workflow_transition_subtitle: "Your case information has been prepared for your doctor. Now choose an appointment time.",
      btn_continue_to_booking: "Continue to Book Appointment →",
      btn_back_to_casesheet: "← Back to Case Sheet",
      btn_back_to_chat: "← Back to Symptom Check",
      appointment_confirmed_title: "Appointment Confirmed!",
      appointment_confirmed_subtitle: "Your case sheet has been attached and will be reviewed by your doctor before your visit.",
      greeting_morning: "Good morning",
      greeting_afternoon: "Good afternoon",
      greeting_evening: "Good evening",
      dashboard_subtitle_patient: "Here's your health overview.",
      next_appointment_title: "Next Appointment",
      last_casesheet_title: "Last Case Sheet",
      quick_actions_title: "Quick Actions",
      recent_activity_title: "Recent Health Activity",
      overview_no_appointment: "No upcoming appointments.",
      overview_no_casesheet: "No case sheets yet.",
      activity_empty: "No recent activity yet — start a Symptom Check to get going.",
      diagnosis_page_subtitle: "Only what your doctor has recorded appears here — Care Crew never generates a diagnosis.",
      diagnosis_tab_previous: "Previous Diagnosis",
      diagnosis_tab_current: "Current Diagnosis",
      diagnosis_tab_dietary: "Dietary",
      diagnosis_previous_empty: "No previous diagnosis on file yet. Diagnoses your doctor records during a review will appear here.",
      diagnosis_current_empty: "No current diagnosis on file yet.",
      diagnosis_dietary_empty: "No dietary guidance on file yet. Your doctor can add dietary notes during a case review.",
      report_status_pending: "Report Status: Awaiting doctor review →",
    },
    hi: {
      brand_name: "Care Crew",
      hero_eyebrow: "हर OPD और PHC के लिए AI-सहायता प्राप्त देखभाल",
      hero_tagline: "बेहतर बातचीत। बेहतर इतिहास। बेहतर देखभाल।",
      hero_tagline_sub: "Care Crew आपको अपनी तकलीफ़ अपने ही शब्दों में बताने में मदद करता है, ताकि आपका डॉक्टर हर विज़िट पहले से जानकारी के साथ शुरू करे।",
      welcome_login: "वापसी पर स्वागत है",
      welcome_register: "अपना खाता बनाएं",
      subtitle_login: "Care Crew जारी रखने के लिए साइन इन करें।",
      subtitle_register: "शुरू करने के लिए Care Crew से जुड़ें।",
      role_patient: "मरीज़",
      role_doctor: "डॉक्टर",
      label_abha: "ABHA ID",
      label_doctor_id: "Doctor ID",
      label_name: "पूरा नाम",
      label_phone: "फ़ोन नंबर",
      label_email_optional: "ईमेल (वैकल्पिक)",
      label_password: "पासवर्ड",
      label_confirm_password: "पासवर्ड की पुष्टि करें",
      label_department: "विभाग",
      label_specialty: "विशेषज्ञता",
      placeholder_abha: "अपना ABHA ID दर्ज करें",
      placeholder_doctor_id: "अपना Doctor ID दर्ज करें",
      placeholder_name: "आपका पूरा नाम",
      placeholder_phone: "10 अंकों का मोबाइल नंबर",
      placeholder_email: "you@example.com",
      placeholder_password: "अपना पासवर्ड दर्ज करें",
      placeholder_confirm_password: "पासवर्ड फिर से दर्ज करें",
      placeholder_department: "जैसे कार्डियोलॉजी",
      placeholder_specialty: "जैसे इंटरवेंशनल कार्डियोलॉजिस्ट",
      btn_login: "लॉग इन करें",
      btn_login_loading: "साइन इन हो रहा है...",
      btn_register: "खाता बनाएं",
      btn_register_loading: "खाता बनाया जा रहा है...",
      toggle_to_register_text: "नए हैं?",
      toggle_to_register_link: "खाता बनाएं",
      toggle_to_login_text: "पहले से खाता है?",
      toggle_to_login_link: "इसके बजाय लॉग इन करें",
      back_to_home: "← होम पर वापस जाएँ",
      show_password: "पासवर्ड दिखाएं",
      hide_password: "पासवर्ड छुपाएं",
      register_success_title: "खाता बन गया!",
      register_success_body: "आपका खाता बन गया है। जारी रखने के लिए लॉग इन करें।",
      err_name_required: "कृपया अपना नाम दर्ज करें",
      err_abha_required: "ABHA ID आवश्यक है",
      err_doctor_id_required: "Doctor ID आवश्यक है",
      err_password_required: "कृपया अपना पासवर्ड दर्ज करें",
      err_password_length: "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए",
      err_confirm_mismatch: "पासवर्ड मेल नहीं खाते",
      err_email_invalid: "कृपया एक मान्य ईमेल पता दर्ज करें",
      err_network: "नेटवर्क त्रुटि — कृपया अपना कनेक्शन जांचें और फिर कोशिश करें।",
      err_generic: "कुछ गलत हो गया। कृपया फिर कोशिश करें।",
      err_abha_taken: "यह ABHA ID पहले से पंजीकृत है",
      err_doctor_id_taken: "यह Doctor ID पहले से पंजीकृत है",
      err_email_taken: "यह ईमेल पहले से पंजीकृत है",
      err_invalid_credentials: "गलत ID या पासवर्ड",
      err_wrong_role: "यह खाता दूसरी भूमिका के अंतर्गत पंजीकृत है — ऊपर टॉगल बदलें और फिर कोशिश करें।",

      nav_home: "होम",
      nav_symptom_check: "लक्षण जाँच और अपॉइंटमेंट",
      nav_case_sheet: "केस शीट",
      nav_appointment: "अपॉइंटमेंट बुक करें",
      nav_diagnosis: "डायग्नोसिस",
      nav_previous_diagnosis: "पिछला डायग्नोसिस",
      nav_current_diagnosis: "वर्तमान डायग्नोसिस",
      nav_dietary: "आहार सलाह",
      nav_profile: "प्रोफ़ाइल",
      workflow_step_1: "लक्षण जाँच",
      workflow_step_2: "केस शीट रिव्यू",
      workflow_step_3: "अपॉइंटमेंट बुक करें",
      workflow_transition_title: "आपकी लक्षण जाँच पूरी हो गई है।",
      workflow_transition_subtitle: "आपके डॉक्टर के लिए आपकी केस जानकारी तैयार कर ली गई है। अब अपॉइंटमेंट का समय चुनें।",
      btn_continue_to_booking: "अपॉइंटमेंट बुकिंग जारी रखें →",
      btn_back_to_casesheet: "← वापस केस शीट पर",
      btn_back_to_chat: "← वापस लक्षण जाँच पर",
      appointment_confirmed_title: "अपॉइंटमेंट की पुष्टि हो गई!",
      appointment_confirmed_subtitle: "आपकी केस शीट जोड़ दी गई है और आपके विज़िट से पहले डॉक्टर द्वारा रिव्यू की जाएगी।",
      greeting_morning: "सुप्रभात",
      greeting_afternoon: "नमस्कार",
      greeting_evening: "शुभ संध्या",
      dashboard_subtitle_patient: "यह रहा आपका स्वास्थ्य विवरण।",
      next_appointment_title: "अगली अपॉइंटमेंट",
      last_casesheet_title: "पिछली केस शीट",
      quick_actions_title: "त्वरित कार्य",
      recent_activity_title: "हाल की स्वास्थ्य गतिविधि",
      overview_no_appointment: "कोई आगामी अपॉइंटमेंट नहीं है।",
      overview_no_casesheet: "अभी तक कोई केस शीट नहीं है।",
      activity_empty: "अभी तक कोई हाल की गतिविधि नहीं — शुरू करने के लिए Symptom Check करें।",
      diagnosis_page_subtitle: "यहाँ सिर्फ वही दिखेगा जो आपके डॉक्टर ने दर्ज किया है — Care Crew कभी डायग्नोसिस नहीं बनाता।",
      diagnosis_tab_previous: "पिछला डायग्नोसिस",
      diagnosis_tab_current: "वर्तमान डायग्नोसिस",
      diagnosis_tab_dietary: "आहार सलाह",
      diagnosis_previous_empty: "अभी तक कोई पिछला डायग्नोसिस दर्ज नहीं है। आपके डॉक्टर द्वारा रिव्यू के दौरान दर्ज डायग्नोसिस यहाँ दिखेंगे।",
      diagnosis_current_empty: "अभी तक कोई वर्तमान डायग्नोसिस दर्ज नहीं है।",
      diagnosis_dietary_empty: "अभी तक कोई आहार सलाह दर्ज नहीं है। आपके डॉक्टर केस रिव्यू के दौरान आहार नोट्स जोड़ सकते हैं।",
      report_status_pending: "रिपोर्ट स्थिति: डॉक्टर रिव्यू का इंतज़ार →",
    },
    hinglish: {
      brand_name: "Care Crew",
      hero_eyebrow: "Har OPD aur PHC ke liye AI-assisted care",
      hero_tagline: "Behtar baatcheet. Behtar history. Behtar dekhbhaal.",
      hero_tagline_sub: "Care Crew aapko apni taklif apne hi shabdon me batane me madad karta hai, taaki aapka doctor har visit pehle se jaankari ke saath shuru kare.",
      welcome_login: "Wapasi par swagat hai",
      welcome_register: "Apna account banayein",
      subtitle_login: "Care Crew continue karne ke liye sign in karein.",
      subtitle_register: "Shuru karne ke liye Care Crew join karein.",
      role_patient: "Patient",
      role_doctor: "Doctor",
      label_abha: "ABHA ID",
      label_doctor_id: "Doctor ID",
      label_name: "Poora Naam",
      label_phone: "Phone Number",
      label_email_optional: "Email (optional)",
      label_password: "Password",
      label_confirm_password: "Password Confirm Karein",
      label_department: "Department",
      label_specialty: "Specialty",
      placeholder_abha: "Apna ABHA ID enter karein",
      placeholder_doctor_id: "Apna Doctor ID enter karein",
      placeholder_name: "Aapka poora naam",
      placeholder_phone: "10-digit mobile number",
      placeholder_email: "you@example.com",
      placeholder_password: "Apna password enter karein",
      placeholder_confirm_password: "Password dobara enter karein",
      placeholder_department: "jaise Cardiology",
      placeholder_specialty: "jaise Interventional Cardiologist",
      btn_login: "Log In Karein",
      btn_login_loading: "Sign in ho raha hai...",
      btn_register: "Account Banayein",
      btn_register_loading: "Account banaya ja raha hai...",
      toggle_to_register_text: "Naye hain?",
      toggle_to_register_link: "Account banayein",
      toggle_to_login_text: "Pehle se account hai?",
      toggle_to_login_link: "Iske bajay login karein",
      back_to_home: "← Home par wapas jayein",
      show_password: "Password dikhayein",
      hide_password: "Password chhupayein",
      register_success_title: "Account ban gaya!",
      register_success_body: "Aapka account ban gaya hai. Continue karne ke liye login karein.",
      err_name_required: "Kripya apna naam daaliye",
      err_abha_required: "ABHA ID zaroori hai",
      err_doctor_id_required: "Doctor ID zaroori hai",
      err_password_required: "Kripya apna password daaliye",
      err_password_length: "Password kam se kam 6 characters ka hona chahiye",
      err_confirm_mismatch: "Passwords match nahi karte",
      err_email_invalid: "Kripya sahi email address daaliye",
      err_network: "Network error — apna connection check karke phir try karein.",
      err_generic: "Kuch galat ho gaya. Kripya phir try karein.",
      err_abha_taken: "Ye ABHA ID pehle se register hai",
      err_doctor_id_taken: "Ye Doctor ID pehle se register hai",
      err_email_taken: "Ye email pehle se register hai",
      err_invalid_credentials: "Galat ID ya password",
      err_wrong_role: "Ye account doosri role ke under register hai — upar toggle badal kar phir try karein.",

      nav_home: "Home",
      nav_symptom_check: "Symptom Check & Book Appointment",
      nav_case_sheet: "Case Sheet",
      nav_appointment: "Appointment Book Karein",
      nav_diagnosis: "Diagnosis",
      nav_previous_diagnosis: "Pichla Diagnosis",
      nav_current_diagnosis: "Abhi ka Diagnosis",
      nav_dietary: "Aahar Salah",
      nav_profile: "Profile",
      workflow_step_1: "Symptom Check",
      workflow_step_2: "Review Case Sheet",
      workflow_step_3: "Book Appointment",
      workflow_transition_title: "Aapki symptom check poori ho gayi hai.",
      workflow_transition_subtitle: "Aapke doctor ke liye case information ready ho gayi hai. Ab appointment ka time choose karein.",
      btn_continue_to_booking: "Continue to Book Appointment →",
      btn_back_to_casesheet: "← Back to Case Sheet",
      btn_back_to_chat: "← Back to Symptom Check",
      appointment_confirmed_title: "Appointment Confirm Ho Gaya!",
      appointment_confirmed_subtitle: "Aapki case sheet attach ho gayi hai aur doctor visit se pehle review karenge.",
      greeting_morning: "Good morning",
      greeting_afternoon: "Good afternoon",
      greeting_evening: "Good evening",
      dashboard_subtitle_patient: "Ye raha aapka health overview.",
      next_appointment_title: "Next Appointment",
      last_casesheet_title: "Pichli Case Sheet",
      quick_actions_title: "Quick Actions",
      recent_activity_title: "Recent Health Activity",
      overview_no_appointment: "Koi upcoming appointment nahi hai.",
      overview_no_casesheet: "Abhi tak koi case sheet nahi hai.",
      activity_empty: "Abhi tak koi recent activity nahi — shuru karne ke liye Symptom Check karein.",
      diagnosis_page_subtitle: "Yahan sirf wahi dikhega jo aapke doctor ne record kiya hai — Care Crew kabhi diagnosis nahi banata.",
      diagnosis_tab_previous: "Pichla Diagnosis",
      diagnosis_tab_current: "Abhi ka Diagnosis",
      diagnosis_tab_dietary: "Aahar Salah",
      diagnosis_previous_empty: "Abhi tak koi pichla diagnosis record nahi hai. Aapke doctor dwara review ke dauran record kiya gaya diagnosis yahan dikhega.",
      diagnosis_current_empty: "Abhi tak koi current diagnosis record nahi hai.",
      diagnosis_dietary_empty: "Abhi tak koi aahar salah record nahi hai. Aapke doctor case review ke dauran aahar notes jod sakte hain.",
      report_status_pending: "Report Status: Doctor review ka intezaar →",
    },
  };

  // Best-effort mapping of KNOWN backend error strings (English, from
  // core/responses.AppError messages) to a translated line. Anything not
  // in this map falls back to the raw backend message untranslated.
  const _backendErrorMap = {
    "ABHA ID is required": "err_abha_required",
    "Doctor ID is required": "err_doctor_id_required",
    "ABHA ID already registered": "err_abha_taken",
    "Doctor ID already registered": "err_doctor_id_taken",
    "Email already registered": "err_email_taken",
    "Invalid ID or password": "err_invalid_credentials",
  };

  let currentLang = "en";

  function t(key) {
    return (translations[currentLang] && translations[currentLang][key]) || translations.en[key] || key;
  }

  function translateBackendError(message) {
    const key = _backendErrorMap[message];
    return key ? t(key) : message;
  }

  function applyToDOM() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const label = t(el.getAttribute("data-i18n-aria-label"));
      el.setAttribute("aria-label", label);
      el.title = label;
    });
    document.dispatchEvent(new CustomEvent("carecrew-lang-changed", { detail: { lang: currentLang } }));
  }

  function setLang(lang) {
    currentLang = translations[lang] ? lang : "en";
    try {
      localStorage.setItem(STORAGE_KEY, currentLang);
    } catch (e) {
      // private-browsing / storage disabled — language just won't persist
    }
    applyToDOM();
  }

  function initLang() {
    let saved = "en";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "en";
    } catch (e) {
      // ignore
    }
    currentLang = translations[saved] ? saved : "en";
    applyToDOM();
  }

  function getLang() {
    return currentLang;
  }

  window.CareCrewI18n = { t, setLang, initLang, getLang, applyToDOM, translateBackendError };
})();
