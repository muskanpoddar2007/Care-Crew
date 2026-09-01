# /voice — ASR + Test Data (Khushi)

## 1. ASR pipeline
Sarvam ya Bhashini se audio -> text (Hindi/Hinglish). Ek function:
`transcribe(audio_file) -> text`

## 2. Test transcripts (ye zyada important hai)
`transcripts/` me 8-10 realistic chest-pain patient conversations likho, Hinglish me.
Alag-alag style:
- seedha jawab dene wala patient
- ghuma ke baat karne wala
- ek jisme red flag ho (pasina + baayein haath me dard)

Ye data ke bina extraction test nahi ho payega. Raw audio commit mat karna (gitignored),
sirf transcripts commit karo.
