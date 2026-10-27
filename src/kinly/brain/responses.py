"""Fixed, reviewed responses for moments that must never depend on an LLM.

Every template exists in English, Hindi and Spanish; other languages fall back to English.
"""

from __future__ import annotations

T = {
    "urgent": {
        "en": "[concerned] {name}, I'm worried about you. Please call {emergency} for emergency help right now, or call {family}. I'm letting your family know at this moment. Are you able to reach your phone?",
        "hi": "[concerned] {name}, मुझे आपकी चिंता हो रही है। कृपया अभी {emergency} पर इमरजेंसी मदद के लिए कॉल कीजिए, या {family} को फ़ोन कीजिए। मैं इसी वक़्त आपके परिवार को बता रही हूँ। क्या आप अपने फ़ोन तक पहुँच सकती हैं?",
        "es": "[concerned] {name}, me preocupa usted. Por favor llame ahora al {emergency} para pedir ayuda de emergencia, o llame a {family}. Estoy avisando a su familia en este momento. ¿Puede alcanzar su teléfono?",
    },
    "self_harm": {
        "en": "[concerned] {name}, thank you for telling me. You matter a great deal, and you don't have to carry this alone. Please call {emergency} or {family} right now. I'm letting your family know so someone can be with you.",
        "hi": "[concerned] {name}, मुझे बताने के लिए धन्यवाद। आप बहुत मायने रखती हैं, और आपको यह अकेले नहीं सहना है। कृपया अभी {emergency} या {family} को फ़ोन कीजिए। मैं आपके परिवार को बता रही हूँ ताकि कोई आपके पास हो।",
        "es": "[concerned] {name}, gracias por decírmelo. Usted es muy importante y no tiene que cargar con esto sola. Por favor llame ahora al {emergency} o a {family}. Estoy avisando a su familia para que alguien esté con usted.",
    },
    "scam": {
        "en": "[concerned] {name}, please be careful. That sounds like it could be a scam. Kinly and your family will never ask you for money, OTPs or passwords over a call. Please don't share anything or send money. I'll let {family} know so they can check.",
        "hi": "[concerned] {name}, ज़रा सावधान रहिए। यह धोखाधड़ी हो सकती है। Kinly और आपका परिवार कभी भी फ़ोन पर पैसे, OTP या पासवर्ड नहीं माँगेगा। कृपया कुछ भी शेयर मत कीजिए और पैसे मत भेजिए। मैं {family} को बता देती हूँ ताकि वो देख लें।",
        "es": "[concerned] {name}, tenga cuidado, por favor. Eso puede ser una estafa. Kinly y su familia nunca le pedirán dinero, códigos OTP ni contraseñas por teléfono. No comparta nada ni envíe dinero. Voy a avisar a {family} para que lo revisen.",
    },
    "scam_reminder": {
        "en": "Just a gentle reminder: Kinly and your family will never ask you for money, OTPs or passwords over a call.",
        "hi": "एक छोटी सी याद: Kinly और आपका परिवार कभी भी फ़ोन पर पैसे, OTP या पासवर्ड नहीं माँगेगा।",
        "es": "Un recordatorio amable: Kinly y su familia nunca le pedirán dinero, códigos ni contraseñas por teléfono.",
    },
    "consent_intro": {
        "en": "[happy] Hello {name}, I'm Kinly. I'm an AI companion, not a person, and your family set me up so we can chat every day. I'll remind you about your medicines, and after our chats I share a short summary with your family. If something sounds unsafe, I will always tell them. Anything else you can ask me to keep between us. Is it alright with you if we talk like this?",
        "hi": "[happy] नमस्ते {name}, मैं Kinly हूँ। मैं एक AI साथी हूँ, इंसान नहीं, और आपके परिवार ने मुझे इसलिए रखा है ताकि हम रोज़ बात कर सकें। मैं आपको दवाइयों की याद दिलाऊँगी, और बातचीत के बाद परिवार को एक छोटा सा सार भेजूँगी। अगर कुछ खतरे वाली बात लगे, तो मैं उन्हें ज़रूर बताऊँगी। बाकी कोई भी बात आप कहें तो हमारे बीच रहेगी। क्या आपको इस तरह बात करना ठीक लगेगा?",
        "es": "[happy] Hola {name}, soy Kinly. Soy una compañera de inteligencia artificial, no una persona, y su familia me configuró para que podamos charlar cada día. Le recordaré sus medicinas y, después de hablar, comparto un breve resumen con su familia. Si algo suena peligroso, siempre se lo diré. Cualquier otra cosa puede pedirme que quede entre nosotros. ¿Le parece bien que hablemos así?",
    },
    "consent_yes": {
        "en": "[happy] Thank you, {name}. I'm so glad. So, how are you feeling today?",
        "hi": "[happy] धन्यवाद {name}, मुझे बहुत खुशी हुई। तो बताइए, आज आप कैसा महसूस कर रही हैं?",
        "es": "[happy] Gracias, {name}. Me alegra mucho. Entonces, ¿cómo se siente hoy?",
    },
    "consent_no": {
        "en": "That's completely alright, {name}. I won't call again unless you or your family ask. Take care.",
        "hi": "बिल्कुल ठीक है {name}। जब तक आप या आपका परिवार न कहें, मैं दोबारा फ़ोन नहीं करूँगी। अपना ख्याल रखिए।",
        "es": "Está bien, {name}. No volveré a llamar a menos que usted o su familia lo pidan. Cuídese.",
    },
    "consent_unclear": {
        "en": "Sorry {name}, I didn't quite catch that. Is it alright if we chat like this? You can just say yes or no.",
        "hi": "माफ़ कीजिए {name}, मैं ठीक से समझ नहीं पाई। क्या इस तरह बात करना ठीक है? बस हाँ या ना कह दीजिए।",
        "es": "Perdón {name}, no le entendí bien. ¿Está bien si charlamos así? Puede decir sí o no.",
    },
    "privacy_ack": {
        "en": "[listening] Of course. That stays between us. I'll only ever share it if it's about your safety.",
        "hi": "[listening] बिल्कुल। यह बात हमारे बीच रहेगी। मैं सिर्फ़ तभी बताऊँगी जब बात आपकी सुरक्षा की हो।",
        "es": "[listening] Por supuesto. Queda entre nosotros. Solo lo compartiría si se trata de su seguridad.",
    },
    "forget_ack": {
        "en": "Done, I've forgotten that.",
        "hi": "ठीक है, मैंने वह बात भुला दी।",
        "es": "Listo, ya lo olvidé.",
    },
    "call_start": {
        "en": "[happy] Of course! I'm calling {contact} for you now. It may take a moment for them to answer.",
        "hi": "[happy] ज़रूर! मैं अभी आपके लिए {contact} को कॉल कर रही हूँ। उन्हें फ़ोन उठाने में थोड़ा समय लग सकता है।",
        "es": "[happy] ¡Claro! Estoy llamando a {contact} ahora mismo. Puede tardar un momento en contestar.",
    },
    "call_unknown": {
        "en": "I'd love to help you call someone. Who would you like to talk to? You can also press the big Call family button.",
        "hi": "मैं ज़रूर कॉल लगा दूँगी। आप किससे बात करना चाहेंगी? आप बड़ा 'परिवार को कॉल' बटन भी दबा सकती हैं।",
        "es": "Con gusto le ayudo a llamar. ¿Con quién le gustaría hablar? También puede tocar el botón grande de Llamar a la familia.",
    },
    "messages": {
        "en": "[happy] You have {count} new message{plural}! Here it is.",
        "hi": "[happy] आपके लिए {count} नया संदेश आया है! यह सुनिए।",
        "es": "[happy] ¡Tiene {count} mensaje{plural} nuevo{plural}! Aquí está.",
    },
    "no_messages": {
        "en": "No new messages right now, but I'm sure your family is thinking of you.",
        "hi": "अभी कोई नया संदेश नहीं है, पर आपका परिवार आपको ज़रूर याद कर रहा होगा।",
        "es": "No hay mensajes nuevos por ahora, pero seguro que su familia piensa en usted.",
    },
    "med_taken": {
        "en": "[happy] Wonderful, thank you {name}. I've noted that you took your {medicine}.",
        "hi": "[happy] बहुत बढ़िया, धन्यवाद {name}। मैंने लिख लिया कि आपने {medicine} ले ली है।",
        "es": "[happy] Muy bien, gracias {name}. Anoté que tomó su {medicine}.",
    },
    "med_not_taken": {
        "en": "That's alright. Could you take your {medicine} now, with a glass of water? I'll check with you again in a little while.",
        "hi": "कोई बात नहीं। क्या आप अभी एक गिलास पानी के साथ {medicine} ले लेंगी? मैं थोड़ी देर में फिर पूछूँगी।",
        "es": "No pasa nada. ¿Podría tomar su {medicine} ahora, con un vaso de agua? Le preguntaré otra vez en un rato.",
    },
    "med_reminder": {
        "en": "[happy] {name}, it's time for your {medicine}. Have you taken it?",
        "hi": "[happy] {name}, आपकी {medicine} का समय हो गया है। क्या आपने ले ली?",
        "es": "[happy] {name}, es hora de su {medicine}. ¿Ya la tomó?",
    },
    "repeat": {
        "en": "Sorry, could you say that again?",
        "hi": "माफ़ कीजिए, क्या आप फिर से कह सकती हैं?",
        "es": "Perdón, ¿podría repetirlo?",
    },
    "trouble": {
        "en": "Sorry {name}, I'm having a little trouble thinking right now. Could you say that again in a moment?",
        "hi": "माफ़ कीजिए {name}, मुझे अभी थोड़ी दिक्कत हो रही है। क्या आप एक पल में फिर से कह सकती हैं?",
        "es": "Perdón {name}, tengo un pequeño problema ahora mismo. ¿Me lo repite en un momento?",
    },
    "goodbye": {
        "en": "[happy] It was lovely talking with you, {name}. Take care, and I'll talk to you soon.",
        "hi": "[happy] आपसे बात करके बहुत अच्छा लगा, {name}। अपना ख्याल रखिए, जल्दी फिर बात करेंगे।",
        "es": "[happy] Fue un placer hablar con usted, {name}. Cuídese, hablamos pronto.",
    },
}


def say(key: str, lang: str, gender: str = "female", **kwargs) -> str:
    table = T[key]
    template = table.get(lang) or table["en"]
    try:
        text = template.format(**kwargs)
    except KeyError:
        text = template
    return adapt_gender(text, lang, gender)


# Templates address the elder in the feminine; Kinly itself speaks in the feminine first person.
_HI_MASC = [
    ("कर रही हैं", "कर रहे हैं"), ("सकती हैं", "सकते हैं"), ("लेंगी", "लेंगे"), ("चाहेंगी", "चाहेंगे"),
    ("रखती हैं", "रखते हैं"), ("आप बहुत मायने रखती", "आप बहुत मायने रखते"),
]
_ES_MASC = [("sola", "solo"), ("deprimida", "deprimido"), ("cansada", "cansado")]


def adapt_gender(text: str, lang: str, gender: str) -> str:
    if gender != "male":
        return text
    pairs = _HI_MASC if lang == "hi" else _ES_MASC if lang == "es" else []
    for fem, masc in pairs:
        text = text.replace(fem, masc)
    return text
