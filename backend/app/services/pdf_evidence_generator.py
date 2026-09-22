import os
import uuid
import hashlib
from datetime import datetime, timezone
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

class PDFEvidenceGenerator:
    """
    Generates the official Maritime Investigation Evidence Dossier PDF
    and calculates its SHA-256 hash for chain-of-custody integrity.
    """
    
    def __init__(self, template_dir: str = None, output_dir: str = None):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.template_dir = template_dir or os.path.join(base_dir, 'templates')
        self.output_dir = output_dir or os.path.join(base_dir, '..', 'storage', 'evidence')
        
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir, exist_ok=True)
            
        self.env = Environment(loader=FileSystemLoader(self.template_dir))

    def generate_dossier(self, incident_data: dict) -> dict:
        """
        Generates the PDF dossier from the provided incident data dictionary.
        
        Args:
            incident_data: Dictionary containing keys mapped in dossier_template.html
                - incident_id
                - detection_time
                - coordinates
                - area_sq_km
                - status
                - satellite_source
                - scene_id
                - segmentation_model_version
                - drift_model_version
                - environmental_source
                - drift_particle_count
                - drift_duration_hrs
                - candidates (list of dicts with name, mmsi, overall_score, etc.)
                
        Returns:
            dict containing file_path, sha256_hash, and generated_at timestamp.
        """
        template = self.env.get_template('dossier_template.html')
        
        # Inject generation timestamp and placeholder for hash
        # The hash cannot be computed until the PDF is generated,
        # so we inject a placeholder, but actually, WeasyPrint doesn't let us easily mutate the PDF after generation without breaking the hash.
        # Solution: The hash is of the *content* or we hash the final PDF file and store it in the database, 
        # presenting it on the UI, but the PDF itself doesn't contain its own hash (which is mathematically impossible).
        # We will put a unique identifier in the PDF, generate it, hash the file, and return both.
        
        # We'll just put a unique generation ID in the template instead of the actual file hash.
        generation_id = str(uuid.uuid4())
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        
        context = {
            **incident_data,
            "generated_at": generated_at,
            "sha256_hash": f"PENDING-CALCULATION-{generation_id}"
        }
        
        html_out = template.render(context)
        
        # Define output path
        filename = f"dossier_{incident_data.get('incident_id', 'unknown')}_{int(datetime.now().timestamp())}.pdf"
        output_path = os.path.join(self.output_dir, filename)
        
        # Generate PDF
        HTML(string=html_out).write_pdf(output_path)
        
        # Calculate SHA-256 of the generated file
        sha256_hash = self._calculate_file_hash(output_path)
        
        return {
            "file_path": output_path,
            "filename": filename,
            "sha256_hash": sha256_hash,
            "generated_at": generated_at
        }

    def _calculate_file_hash(self, filepath: str) -> str:
        sha256 = hashlib.sha256()
        with open(filepath, 'rb') as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()
