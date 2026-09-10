"""
Verbatim Reference Transcripts & Specifications for Dual-Mode Consultation.

Includes:
1. Allopathic chest pain transcripts (10 scenarios)
2. Ayurveda Dynamic Core & Knee Pain transcript
3. MCQ question specifications for both modes
"""

from app.data.chest_pain_convos import CONVERSATIONS as CHEST_PAIN_TRANSCRIPTS

AYURVEDA_TRANSCRIPT = {
    "title": "Ayurveda Knee Pain Consultation",
    "turns": [
        {"role": "doctor", "text": "Namaste. What is your main concern?"},
        {"role": "patient", "text": "I've been having pain in my knees."},
        {"role": "doctor", "text": "Since when?"},
        {"role": "patient", "text": "Around three months."},
        {"role": "doctor", "text": "Is the pain present all the time or does it come and go?"},
        {"role": "patient", "text": "It comes and goes."},
        {"role": "doctor", "text": "When does it become worse?"},
        {"role": "patient", "text": "After walking or standing for a long time."},
        {"role": "doctor", "text": "Do you experience stiffness, especially in the morning?"},
        {"role": "patient", "text": "Yes, sometimes my knees feel stiff in the morning."},
        {"role": "doctor", "text": "Is there any swelling?"},
        {"role": "patient", "text": "Sometimes there is slight swelling."},
        {"role": "doctor", "text": "Did the pain start after an injury?"},
        {"role": "patient", "text": "No."},
        {"role": "doctor", "text": "How active are you during the day?"},
        {"role": "patient", "text": "I mostly sit at work and don't exercise much."},
        {"role": "doctor", "text": "How is your appetite and digestion?"},
        {"role": "patient", "text": "My appetite is normal, but I sometimes have constipation."},
        {"role": "doctor", "text": "How often do you pass stool?"},
        {"role": "patient", "text": "Usually once a day, but sometimes I skip a day."},
        {"role": "doctor", "text": "How is your sleep?"},
        {"role": "patient", "text": "Around seven hours."},
        {"role": "doctor", "text": "Do you feel excessive stress?"},
        {"role": "patient", "text": "Occasionally."},
        {"role": "doctor", "text": "Have you taken any medication for the knee pain?"},
        {"role": "patient", "text": "Yes, I took painkillers a few times."},
        {"role": "doctor", "text": "Do you have any other medical conditions?"},
        {"role": "patient", "text": "No."},
        {
            "role": "doctor",
            "text": "Thank you. I have recorded your history. I will connect you to booking appointment section",
        },
    ],
}

# --- Dynamic Core specifications (Ayurveda: collected right after chief complaint) ---
AYURVEDA_CORE_QUESTIONS = [
    {
        "slot": "ayurveda.agni_appetite",
        "question": {
            "english": "How is your daily appetite and hunger?",
            "hinglish": "Aapki daily appetite aur bhookh kaisi rehti hai?",
            "hindi": "आपकी दैनिक भूख और पाचन आमतौर पर कैसा रहता है?",
        },
        "options": ["Strong and regular", "Variable", "Low", "Excessive"],
        "is_mcq": True,
    },
    {
        "slot": "ayurveda.agni_bowel",
        "question": {
            "english": "How regular is your digestion and bowel routine?",
            "hinglish": "Aapka digestion aur pet saaf hona kitna regular rehta hai?",
            "hindi": "आपका पेट साफ होना और पाचन कितना नियमित है?",
        },
        "options": ["Very regular", "Occasionally irregular", "Often irregular"],
        "is_mcq": True,
    },
    {
        "slot": "ayurveda.sleep",
        "question": {
            "english": "How would you describe your sleep quality?",
            "hinglish": "Aapki sleep kaisi rehti hai — neend aane mein dikkat ya beech mein khulna?",
            "hindi": "आपकी नींद कैसी रहती है?",
        },
        "options": [
            "Sound and restful",
            "Take a while to fall asleep",
            "Wake up often",
            "Wake up tired",
        ],
        "is_mcq": True,
    },
    {
        "slot": "ayurveda.thermal",
        "question": {
            "english": "Do you tend to feel more sensitive to heat or cold?",
            "hinglish": "Aapko thand zyada lagti hai ya garmi zyada lagti hai?",
            "hindi": "आपको ठंड अधिक लगती है या गर्मी अधिक लगती है?",
        },
        "options": ["More sensitive to heat", "More sensitive to cold", "No strong preference"],
        "is_mcq": True,
    },
]

# --- Problem-Focused Branching for Ayurveda ---
AYURVEDA_BRANCH_QUESTIONS = {
    "joint_muscle": [
        {
            "slot": "ayurveda.joint_movement",
            "question": {
                "english": "Is the discomfort worse with movement or worse with rest?",
                "hinglish": "Ye dard chalne-firne se badhta hai ya aaram karne se?",
                "hindi": "यह दर्द चलने-फिरने से बढ़ता है या आराम करने से?",
            },
            "options": ["Worse with movement", "Worse with rest", "Both", "Neither"],
            "is_mcq": True,
        },
        {
            "slot": "ayurveda.morning_stiffness",
            "question": {
                "english": "Do you experience stiffness in the joints, especially in the morning?",
                "hinglish": "Subah uthne par joints mein akadpan ya stiffness mehsoos hoti hai?",
                "hindi": "क्या सुबह उठने पर जोड़ों में अकड़न महसूस होती है?",
            },
            "options": ["Noticeable morning stiffness", "Mild stiffness", "No stiffness"],
            "is_mcq": True,
        },
        {
            "slot": "ayurveda.swelling",
            "question": {
                "english": "Is there any visible swelling around the affected area?",
                "hinglish": "Kya us jagah par koi visible sujan ya swelling hai?",
                "hindi": "क्या उस स्थान पर कोई सूजन दिखाई देती है?",
            },
            "options": ["Yes, visible swelling", "Mild puffiness", "No swelling"],
            "is_mcq": True,
        },
    ],
    "digestive": [
        {
            "slot": "ayurveda.digestive_timing",
            "question": {
                "english": "When does the discomfort mostly occur?",
                "hinglish": "Ye taklif kab zyada hoti hai?",
                "hindi": "यह परेशानी मुख्य रूप से कब होती है?",
            },
            "options": ["Immediately after eating", "2–3 hours after meals", "Empty stomach", "No fixed pattern"],
            "is_mcq": True,
        },
        {
            "slot": "ayurveda.food_triggers",
            "question": {
                "english": "Do certain foods trigger or worsen your discomfort?",
                "hinglish": "Kisi specific food jaise tel-masale ya doodh se taklif badhti hai?",
                "hindi": "क्या किसी खास भोजन जैसे मसालेदार या तले हुए खाने से परेशानी बढ़ती है?",
            },
            "options": ["Spicy foods", "Greasy / oily foods", "Dairy products", "Heavy / late meals"],
            "is_mcq": True,
        },
        {
            "slot": "ayurveda.sensation_type",
            "question": {
                "english": "What kind of sensation do you feel?",
                "hinglish": "Kaisa mehsoos hota hai — jalan, pet mein bhaari-pan, ya gas?",
                "hindi": "कैसा महसूस होता है — जलन, भारीपन, या गैस?",
            },
            "options": ["Burning sensation", "Heaviness / fullness", "Gas & bloating", "Cramping"],
            "is_mcq": True,
        },
    ],
    "skin": [
        {
            "slot": "ayurveda.skin_sensation",
            "question": {
                "english": "How does the skin feel in that area?",
                "hinglish": "Skin par kaisa feel hota hai?",
                "hindi": "त्वचा पर कैसा महसूस होता है?",
            },
            "options": ["Hot and itchy", "Dry and flaky", "Red and irritated", "Burning sensation"],
            "is_mcq": True,
        },
        {
            "slot": "ayurveda.flare_triggers",
            "question": {
                "english": "Do symptoms flare up after certain foods or with seasonal changes?",
                "hinglish": "Mausam badalne par ya kisi specific food se ye badhta hai?",
                "hindi": "क्या मौसम बदलने या किसी विशेष भोजन से यह बढ़ता है?",
            },
            "options": ["Seasonal change", "Certain foods", "Sweating / heat", "No clear trigger"],
            "is_mcq": True,
        },
    ],
    "anxiety_sleep": [
        {
            "slot": "ayurveda.racing_mind",
            "question": {
                "english": "Do you experience racing thoughts or difficulty settling the mind at night?",
                "hinglish": "Raat ko sone ke time dimaag mein bohot thoughts aate hain ya bechaini hoti hai?",
                "hindi": "क्या रात में मन में बहुत विचार आते हैं या बेचैनी रहती है?",
            },
            "options": ["Frequently at night", "Occasionally", "Rarely", "Never"],
            "is_mcq": True,
        },
        {
            "slot": "ayurveda.stress_digestion",
            "question": {
                "english": "Does stress or tension tend to affect your stomach or digestion?",
                "hinglish": "Stress ya tension lene par pet mein koi asar (jaise gas, bhookh band) hota hai?",
                "hindi": "क्या तनाव से आपके पेट या पाचन पर असर पड़ता है?",
            },
            "options": ["Yes, strong stomach impact", "Mild effect", "No effect"],
            "is_mcq": True,
        },
    ],
    "general": [
        {
            "slot": "ayurveda.duration_pattern",
            "question": {
                "english": "How long has this discomfort been troubling you?",
                "hinglish": "Ye taklif kitne samay se ho rahi hai?",
                "hindi": "यह परेशानी कितने समय से हो रही है?",
            },
            "options": ["1–3 days", "1–2 weeks", "A few months", "Long-term / recurring"],
            "is_mcq": True,
        },
        {
            "slot": "ayurveda.remedies_tried",
            "question": {
                "english": "Have you tried any home remedies or previous treatments for this?",
                "hinglish": "Iske liye pehle koi gharelu upchaar ya dawai li hai?",
                "hindi": "इसके लिए क्या आपने पहले कोई घरेलू उपचार या दवा ली है?",
            },
            "options": None,
            "is_mcq": False,
        },
    ],
}

# --- Allopathic Standard Skeleton & Category Questions ---
ALLOPATHIC_SKELETON_QUESTIONS = [
    {
        "slot": "hopi.onset",
        "question": {
            "english": "When did this start, and was it sudden or gradual?",
            "hinglish": "Kab se ho raha hai? Achanak shuru hua ya dheere-dheere?",
            "hindi": "यह कब से हो रहा है? अचानक शुरू हुआ या धीरे-धीरे?",
        },
        "options": ["Today", "1–3 days ago", "More than a week ago", "Off and on for a while"],
        "is_mcq": True,
    },
    {
        "slot": "hopi.character",
        "question": {
            "english": "What does the discomfort feel like?",
            "hinglish": "Kaisa dard hai? Pressure jaisa, jalan, ya chubhne jaisa?",
            "hindi": "दर्द किस तरह का है? दबाव, जलन, या चुभन जैसा?",
        },
        "options": ["Pressure or heaviness", "Burning sensation", "Sharp or stabbing", "Dull ache"],
        "is_mcq": True,
    },
    {
        "slot": "hopi.location",
        "question": {
            "english": "Where exactly is the discomfort located?",
            "hinglish": "Dard exactly kahan hota hai? Centre mein, side mein, ya kisi specific point par?",
            "hindi": "दर्द शरीर में ठीक किस जगह महसूस होता है?",
        },
        "options": None,
        "is_mcq": False,
    },
    {
        "slot": "hopi.radiation",
        "question": {
            "english": "Does the pain spread anywhere, such as your left arm, shoulder, jaw, or back?",
            "hinglish": "Kya dard kahin aur jaata hai? Left arm, shoulder, jaw ya back mein?",
            "hindi": "क्या दर्द कहीं और फैलता है, जैसे बाएँ हाथ, कंधे, जबड़े या पीठ में?",
        },
        "options": ["Radiates to left arm/shoulder", "Radiates to jaw/neck", "Radiates to back", "Does not radiate"],
        "is_mcq": True,
    },
    {
        "slot": "hopi.aggravating",
        "question": {
            "english": "Does it get worse with walking, physical activity, meals, or rest?",
            "hinglish": "Chalne, stairs chadhne, khana khaane ya letne se badhta hai?",
            "hindi": "क्या चलने, सीढ़ियाँ चढ़ने, खाना खाने या लेटने से यह बढ़ता है?",
        },
        "options": ["Worse with exertion / stairs", "Worse after meals", "Worse lying down / movement", "No clear trigger"],
        "is_mcq": True,
    },
    {
        "slot": "review_of_systems.associated",
        "question": {
            "english": "Are you experiencing any breathlessness, sweating, nausea, or dizziness?",
            "hinglish": "Saath mein saans phoolna, sweating, chakkar ya nausea?",
            "hindi": "क्या साथ में साँस फूलना, पसीना आना, चक्कर या उल्टी जैसा महसूस हो रहा है?",
        },
        "options": None,
        "is_mcq": False,
    },
    {
        "slot": "hopi.severity",
        "question": {
            "english": "How much pain or discomfort are you experiencing right now?",
            "hinglish": "Abhi dard kitna tez hai? 1 se 10 scale pe ya mild/moderate/high?",
            "hindi": "अभी दर्द की तीव्रता कितनी है?",
        },
        "options": ["Mild", "Moderate", "High / Severe"],
        "is_mcq": True,
    },
    {
        "slot": "past_history",
        "question": {
            "english": "Do you have any prior history of similar episodes, diagnosed medical conditions, or old reports available?",
            "hinglish": "Pehle kabhi aisi problem hui hai, ya koi purani report ya chal rahi bimari hai?",
            "hindi": "क्या पहले कभी ऐसी समस्या हुई है, या कोई पुरानी रिपोर्ट या बीमारी है?",
        },
        "options": None,
        "is_mcq": False,
    },
]
