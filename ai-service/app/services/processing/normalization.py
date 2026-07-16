# ai-service/app/services/processing/normalization.py

import re 
import unicodedata 

class TextNormalizationService:
    async def normalize(self, text: str,)->str:
        text = unicodedata.nomalize("NFKC",text,)
        text = text.replace("\r\n","\n")
        text = re.sub(fr"\n{3,}","\n\n",text,)
        text = re.sub(r"[ \t]+"," ",text,)
        return text.strip()

normalization_service = TextNormalizationService()