import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Recorder({ sentence, user, onUploadSuccess }) {
    const [isRecording, setIsRecording] = useState(false)
    const [audioUrl, setAudioUrl] = useState(null)
    const isPressingRef = useRef(false)
    const [audioBlob, setAudioBlob] = useState(null)
    const [isUploading, setIsUploading] = useState(false)
    const [recordingDuration, setRecordingDuration] = useState(0)
    const [errorMsg, setErrorMsg] = useState(null)

    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])
    const timerRef = useRef(null)
    const startTimeRef = useRef(0)
    const streamRef = useRef(null)

    // Reset when sentence changes
    useEffect(() => {
        handleReRecord()
        setErrorMsg(null)
    }, [sentence?.id])

    // Cleanup on unmount
    useEffect(() => {
        return () => stopRecordingCleanup()
    }, [])

    const getDeviceType = () => {
        return /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    }

    const getAudioMimeType = () => {
        if (typeof MediaRecorder === 'undefined') return ''
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/mpeg',
            'audio/ogg;codecs=opus'
        ]
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type
        }
        return ''
    }

    const stopRecordingCleanup = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
    }

    const triggerVibrate = (pattern) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
                navigator.vibrate(pattern)
            } catch (e) {
                // ignore
            }
        }
    }

    const handleStartRecording = async (e) => {
        // Prevent default on touch to avoid double firing
        if (e.type === 'touchstart' && e.cancelable) {
            e.preventDefault()
        }

        if (isRecording || audioUrl || isPressingRef.current) return

        isPressingRef.current = true
        setErrorMsg(null)

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,
                    channelCount: 1, // Mono
                    echoCancellation: true,
                    noiseSuppression: true
                }
            })

            if (!isPressingRef.current) {
                // User released before permission was granted
                stream.getTracks().forEach(track => track.stop())
                return
            }

            streamRef.current = stream
            const mimeType = getAudioMimeType()
            const options = mimeType ? { mimeType } : undefined

            const mediaRecorder = new MediaRecorder(stream, options)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const audioFormat = mediaRecorderRef.current?.mimeType || 'audio/webm'
                const blob = new Blob(audioChunksRef.current, { type: audioFormat })
                const url = URL.createObjectURL(blob)
                setAudioBlob(blob)
                setAudioUrl(url)

                const durationSecs = Math.round((Date.now() - startTimeRef.current) / 1000)
                setRecordingDuration(Math.max(1, durationSecs))
            }

            mediaRecorder.start(200)
            setIsRecording(true)
            triggerVibrate(50)

            startTimeRef.current = Date.now()
            setRecordingDuration(0)

            timerRef.current = setInterval(() => {
                setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
            }, 1000)

        } catch (err) {
            console.error('Mic error:', err)
            isPressingRef.current = false
            setErrorMsg('Microphone permission denied. Please allow microphone access.')
        }
    }

    const handleStopRecording = (e) => {
        if (e?.type === 'touchend' || e?.type === 'touchcancel') {
            if (e.cancelable) e.preventDefault()
        }

        isPressingRef.current = false

        if (!isRecording) return

        setIsRecording(false)
        triggerVibrate([50, 50, 50])
        stopRecordingCleanup()
    }

    const handleReRecord = () => {
        setAudioUrl(null)
        setAudioBlob(null)
        setRecordingDuration(0)
    }

    const handleUpload = async () => {
        if (!audioBlob || !sentence || !user) return

        setIsUploading(true)
        setErrorMsg(null)

        try {
            const audioFormat = mediaRecorderRef.current?.mimeType.split(';')[0] || 'audio/webm'
            const extension = audioFormat.split('/')[1] || 'webm'
            const timestamp = Date.now()

            // Strict filename generation required by user: userId_sentenceId_timestamp
            const fileName = `${user.id}_${sentence.id}_${timestamp}.${extension}`

            // 1. Upload logic
            const { data: storageData, error: storageError } = await supabase
                .storage
                .from('audio-recordings')
                .upload(fileName, audioBlob, { contentType: audioFormat })

            if (storageError) throw storageError

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('audio-recordings')
                .getPublicUrl(fileName)

            // 3. Save into Recordings table
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            const metadata = currentUser.user_metadata || {}

            const { error: dbError } = await supabase
                .from('recordings')
                .insert([{
                    sentence_id: sentence.id,
                    audio_url: publicUrl,
                    speech_to_text: null, // Future Whisper sync
                    user_id: user.id,
                    name: metadata.name || '',
                    gender: metadata.gender || '',
                    age: metadata.age || null,
                    email: user.email,
                    device_type: getDeviceType(), // Extra useful telemetry
                    audio_format: audioFormat
                }])

            if (dbError) throw dbError

            // Success
            handleReRecord()
            if (onUploadSuccess) onUploadSuccess()

        } catch (error) {
            console.error('Upload failed:', error)
            setErrorMsg(error.message || 'Upload failed. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0')
        const s = (secs % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    return (
        <div className="flex flex-col items-center justify-center p-6 w-full max-w-lg mx-auto space-y-8">

            {errorMsg && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm w-full text-center border border-red-200">
                    {errorMsg}
                </div>
            )}

            {!audioUrl ? (
                <div className="flex flex-col items-center space-y-6">
                    <div className={`text-3xl font-mono transition-opacity ${isRecording ? 'opacity-100 text-red-500' : 'opacity-0'}`}>
                        <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2 mb-1"></span>
                        {formatTime(recordingDuration)}
                    </div>

                    <button
                        onMouseDown={handleStartRecording}
                        onMouseUp={handleStopRecording}
                        onMouseLeave={handleStopRecording}
                        onTouchStart={handleStartRecording}
                        onTouchEnd={handleStopRecording}
                        onTouchCancel={handleStopRecording}
                        className={`
              relative flex items-center justify-center w-32 h-32 rounded-full transition-all select-none
              ${isRecording ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/50' : 'bg-blue-600 hover:bg-blue-700 shadow-xl active:scale-95'}
            `}
                        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'none' }}
                    >
                        {isRecording && (
                            <div className="absolute inset-0 rounded-full border-[12px] border-red-400 animate-ping opacity-75"></div>
                        )}
                        <MicIcon className="w-12 h-12 text-white z-10" />
                    </button>

                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {isRecording ? 'Recording... release to stop' : 'Press and hold to record'}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col items-center space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl w-full flex flex-col items-center border border-gray-200 dark:border-gray-700 shadow-inner">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Duration: {formatTime(recordingDuration)}
                        </span>
                        <audio controls src={audioUrl} className="w-full h-10" />
                    </div>

                    <div className="flex flex-col sm:flex-row w-full gap-4">
                        <button
                            onClick={handleReRecord}
                            disabled={isUploading}
                            className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 font-medium"
                        >
                            Re-record
                        </button>

                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/30 transition-all disabled:opacity-50 flex items-center justify-center font-bold text-lg"
                        >
                            {isUploading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Uploading...
                                </>
                            ) : 'Submit Recording'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

function MicIcon({ className }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
        </svg>
    )
}
