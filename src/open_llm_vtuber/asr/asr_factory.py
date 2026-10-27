from typing import Type
from .asr_interface import ASRInterface


class ASRFactory:
    @staticmethod
    def get_asr_system(system_name: str, **kwargs) -> Type[ASRInterface]:
        if system_name == "faster_whisper":
            from .faster_whisper_asr import VoiceRecognition as FasterWhisperASR

            return FasterWhisperASR(
                model_path=kwargs.get("model_path"),
                download_root=kwargs.get("download_root"),
                language=kwargs.get("language"),
                device=kwargs.get("device"),
                compute_type=kwargs.get("compute_type"),
                prompt=kwargs.get("prompt", None),
            )
        elif system_name == "whisper_cpp":
            from .whisper_cpp_asr import VoiceRecognition as WhisperCPPASR

            return WhisperCPPASR(**kwargs)
        elif system_name == "whisper":
            from .openai_whisper_asr import VoiceRecognition as WhisperASR

            return WhisperASR(**kwargs)
        elif system_name == "fun_asr":
            from .fun_asr import VoiceRecognition as FunASR

            return FunASR(
                model_name=kwargs.get("model_name"),
                vad_model=kwargs.get("vad_model"),
                punc_model=kwargs.get("punc_model"),
                ncpu=kwargs.get("ncpu"),
                hub=kwargs.get("hub"),
                device=kwargs.get("device"),
                language=kwargs.get("language"),
                use_itn=kwargs.get("use_itn"),
                # sample_rate=kwargs.get("sample_rate"),
            )
        elif system_name == "azure_asr":
            from .azure_asr import VoiceRecognition as AzureASR

            return AzureASR(
                subscription_key=kwargs.get("api_key"),
                region=kwargs.get("region"),
                languages=kwargs.get("languages", ["en-US", "zh-CN"]),
            )
        elif system_name == "groq_whisper_asr":
            from .groq_whisper_asr import VoiceRecognition as GroqWhisperASR

            return GroqWhisperASR(
                api_key=kwargs.get("api_key"),
                model=kwargs.get("model"),
                lang=kwargs.get("lang"),
            )
        elif system_name == "sherpa_onnx_asr":
            from .sherpa_onnx_asr import VoiceRecognition as SherpaOnnxASR

            return SherpaOnnxASR(**kwargs)
        elif system_name == "deepgram_asr":
            from .deepgram_asr import VoiceRecognition as DeepgramASR

            return DeepgramASR(
                api_key=kwargs.get("api_key"),
                model=kwargs.get("model", "nova-3"),
                detect_languages=kwargs.get("detect_languages"),
            )
        elif system_name == "sarvam_asr":
            from .sarvam_asr import VoiceRecognition as SarvamASR

            return SarvamASR(
                api_key=kwargs.get("api_key"),
                model=kwargs.get("model", "saaras:v4"),
                language_code=kwargs.get("language_code", "unknown"),
            )
        elif system_name == "kinly_router_asr":
            from ...kinly.language_router import RouterASR

            return RouterASR(
                deepgram_model=kwargs.get("deepgram_model", "nova-3"),
                sarvam_model=kwargs.get("sarvam_model", "saaras:v4"),
            )
        else:
            raise ValueError(f"Unknown ASR system: {system_name}")
