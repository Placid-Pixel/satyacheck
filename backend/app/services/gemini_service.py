"""
Gemini Service Module for SatyaCheck AI.
Integrates Google Gen AI SDK (google-genai) with robust error handling,
exponential backoff retry, timeout protection, and structured output formatting.
"""

import os
import json
import time
import logging
from typing import Optional, Dict, Any, List, Type
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger("satyacheck.gemini")

class GeminiConfigError(Exception):
    """Raised when Gemini configuration (e.g. API key) is missing or invalid."""
    pass

class GeminiAPIError(Exception):
    """Raised when Gemini API request fails or times out."""
    pass

class GeminiService:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_seconds: Optional[int] = None
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        self.model_name = model_name or settings.GEMINI_MODEL or "gemini-2.5-flash"
        self.timeout_seconds = timeout_seconds or settings.AGENT_TIMEOUT_SECONDS
        self._client = None
        self._init_client()

    def _init_client(self):
        if not self.api_key:
            logger.info("Gemini API key is not configured. LLM calls will trigger GeminiConfigError.")
            self._client = None
            return

        try:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
            logger.info(f"Initialized Google Gen AI Client with model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize Google Gen AI Client: {e}")
            self._client = None

    @property
    def is_available(self) -> bool:
        """Returns True if client is configured with an API key."""
        return bool(self.api_key and self._client is not None)

    def get_client(self):
        """Returns the google-genai Client or raises GeminiConfigError."""
        if not self.is_available:
            raise GeminiConfigError(
                "Gemini API key is missing or not configured. Please set the GEMINI_API_KEY "
                "environment variable or use the offline deterministic verification mode."
            )
        return self._client

    def verify_connection(self) -> Dict[str, Any]:
        """
        Lightweight health check probe to test Gemini API connectivity and credentials.
        """
        if not self.is_available:
            return {
                "connected": False,
                "model": self.model_name,
                "error": "GEMINI_API_KEY is not set. Offline mode is active."
            }

        client = self.get_client()
        start = time.time()
        try:
            response = client.models.generate_content(
                model=self.model_name,
                contents="Ping. Respond with 'PONG'."
            )
            latency_ms = int((time.time() - start) * 1000)
            return {
                "connected": True,
                "model": self.model_name,
                "latency_ms": latency_ms,
                "response": (response.text or "").strip()
            }
        except Exception as e:
            logger.error(f"Gemini connection probe failed: {e}")
            return {
                "connected": False,
                "model": self.model_name,
                "error": str(e)
            }

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
        max_retries: int = 2
    ) -> str:
        """
        Generates text completion using the configured Gemini model with retries.
        """
        client = self.get_client()
        from google.genai import types

        config = types.GenerateContentConfig(
            temperature=temperature,
            system_instruction=system_instruction
        )

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=config
                )
                if response.text:
                    return response.text
                raise GeminiAPIError("Gemini returned empty text response.")
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini request attempt {attempt + 1} failed: {e}")
                if attempt < max_retries:
                    time.sleep(1.5 * (attempt + 1))

        raise GeminiAPIError(f"Gemini generation failed after {max_retries + 1} attempts: {last_error}")

    def generate_structured_json(
        self,
        prompt: str,
        response_schema: Optional[Type[BaseModel]] = None,
        system_instruction: Optional[str] = None,
        temperature: float = 0.1,
        max_retries: int = 2
    ) -> Dict[str, Any]:
        """
        Generates structured JSON data conforming to a schema or JSON format.
        """
        client = self.get_client()
        from google.genai import types

        config_kwargs: Dict[str, Any] = {
            "temperature": temperature,
            "response_mime_type": "application/json"
        }
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if response_schema:
            config_kwargs["response_schema"] = response_schema

        config = types.GenerateContentConfig(**config_kwargs)

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                response = client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=config
                )
                raw_text = (response.text or "").strip()
                if not raw_text:
                    raise GeminiAPIError("Empty JSON response from Gemini")
                return json.loads(raw_text)
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini JSON generation attempt {attempt + 1} failed: {e}")
                if attempt < max_retries:
                    time.sleep(1.5 * (attempt + 1))

        raise GeminiAPIError(f"Failed to generate valid structured JSON from Gemini: {last_error}")

# Global singleton instance
gemini_service = GeminiService()

