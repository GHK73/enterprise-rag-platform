# ai-service/services/processing/temp_storage.py

import shutil
import tempfile 
from pathlib import Path 

class TemporaryStorage:
    def create_workspace(self)->Path:
        return Path(tempfile.mkdtemp(prefix="rag_document_"))

    def cleanup(self,workspace: Path)->None:
        if workspace.exists():
            shutil.rmtree(workspace, ignore_errors=True,)

temporary_storage = TemporaryStorage()