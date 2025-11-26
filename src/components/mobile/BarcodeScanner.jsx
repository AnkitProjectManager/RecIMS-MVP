import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, X, Flashlight, FlashlightOff, SwitchCamera, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function BarcodeScanner({ onScan, onClose, title = "Scan Barcode" }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [scanSuccess, setScanSuccess] = useState(false);
  const scanIntervalRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    // Check for available cameras
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        // Prefer back camera on mobile
        const backCamera = videoDevices.findIndex(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear')
        );
        if (backCamera !== -1) {
          setCurrentCameraIndex(backCamera);
        }
      });

    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    try {
      setError(null);
      
      const constraints = {
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
          deviceId: cameras[currentCameraIndex]?.deviceId
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      streamRef.current = mediaStream;
      
      // Check if flash is available
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      setHasFlash(capabilities.torch === true);
      
      setScanning(true);
      startScanning();
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please check permissions.");
    }
  };

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    const activeStream = streamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setScanning(false);
    setFlashOn(false);
  }, []);

  const toggleFlash = async () => {
    if (!streamRef.current || !hasFlash) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      await track.applyConstraints({
        advanced: [{ torch: !flashOn }]
      });
      setFlashOn(!flashOn);
    } catch (err) {
      console.error("Flash toggle error:", err);
    }
  };

  const switchCamera = async () => {
    stopCamera();
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    setTimeout(() => startCamera(), 100);
  };

  const startScanning = () => {
    scanIntervalRef.current = setInterval(() => {
      captureAndDecode();
    }, 500); // Scan every 500ms
  };

  const captureAndDecode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Try to decode barcode
    decodeBarcode(imageData);
  };

  const decodeBarcode = (imageData) => {
    // Simple barcode detection using luminance patterns
    // In production, use a library like jsQR or QuaggaJS
    
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Sample center region for barcode
    const centerY = Math.floor(height / 2);
    const startX = Math.floor(width * 0.2);
    const endX = Math.floor(width * 0.8);
    
    let barPattern = [];
    let lastValue = -1;
    let count = 0;
    
    for (let x = startX; x < endX; x++) {
      const index = (centerY * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      
      // Calculate luminance
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const threshold = 128;
      const value = luminance > threshold ? 1 : 0;
      
      if (value === lastValue) {
        count++;
      } else {
        if (count > 0) {
          barPattern.push(count);
        }
        count = 1;
        lastValue = value;
      }
    }
    
    // If we detect a pattern that looks like a barcode
    if (barPattern.length > 10 && barPattern.length < 100) {
      // Mock barcode for demo - in production use real decoder
      const mockBarcode = `BAR${Date.now().toString().slice(-8)}`;
      handleScanSuccess(mockBarcode);
    }
  };

  const handleScanSuccess = (barcodeData) => {
    setScanSuccess(true);
    
    // Vibrate if available
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
    
    // Stop scanning
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    
    setTimeout(() => {
      stopCamera();
      onScan(barcodeData);
    }, 800);
  };

  const handleManualEntry = () => {
    const barcode = prompt("Enter barcode manually:");
    if (barcode) {
      handleScanSuccess(barcode);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Camera View */}
      <div className="relative w-full h-full">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Scanning Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Scanning Frame */}
            <div className="w-72 h-48 border-4 border-white rounded-lg relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500"></div>
              
              {/* Scanning Line */}
              {scanning && !scanSuccess && (
                <motion.div
                  className="absolute left-0 right-0 h-0.5 bg-green-500"
                  animate={{ top: ['0%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              )}
              
              {/* Success Indicator */}
              <AnimatePresence>
                {scanSuccess && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-90 rounded-lg"
                  >
                    <CheckCircle2 className="w-16 h-16 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <p className="text-white text-center mt-4 text-sm">
              {title}
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-lg">{title}</h2>
            <Button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex items-center justify-center gap-4">
            {!scanning && (
              <Button
                onClick={startCamera}
                className="bg-green-600 hover:bg-green-700 gap-2 px-8"
              >
                <Camera className="w-5 h-5" />
                Start Scanning
              </Button>
            )}
            
            {scanning && (
              <>
                {hasFlash && (
                  <Button
                    onClick={toggleFlash}
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 w-12 h-12 rounded-full"
                  >
                    {flashOn ? <FlashlightOff className="w-6 h-6" /> : <Flashlight className="w-6 h-6" />}
                  </Button>
                )}
                
                {cameras.length > 1 && (
                  <Button
                    onClick={switchCamera}
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 w-12 h-12 rounded-full"
                  >
                    <SwitchCamera className="w-6 h-6" />
                  </Button>
                )}
              </>
            )}
          </div>
          
          <Button
            onClick={handleManualEntry}
            variant="ghost"
            className="w-full mt-4 text-white hover:bg-white/20"
          >
            Enter Manually
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute bottom-24 left-4 right-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}