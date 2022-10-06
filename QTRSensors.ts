

enum QTREmitters{
    All,
    Odd,
    Even,
    None
}

enum QTRReadMode{
    Off,
    On,
    OnAndOff,
    OddEven,
    OddEvenAndOff,
    Manual
}

/**
  * Enumeration of ReadADC.
  */
enum ADC {
    //% block="ADC 0"
    ADC0 = 132,
    //% block="ADC 1"
    ADC1 = 196,
    //% block="ADC 2"
    ADC2 = 148,
    //% block="ADC 3"
    ADC3 = 212,
    //% block="ADC 4"
    ADC4 = 164,
    //% block="ADC 5"
    ADC5 = 228,
    //% block="ADC 6"
    ADC6 = 180,
    //% block="ADC 7"
    ADC7 = 244
}

/**
 * Custom blocks /f23c monster /f2d6 นักบินอวกาศ /f2dd
 */
//% weight=100 color=#2FE7F0 icon="\uf0fb"

namespace QTRSensors {

    let QTRNoEmitterPin = 255
    let _type = "Undefined"
    let QTRRCDefaultTimeout = 2500
    let _maxValue = QTRRCDefaultTimeout
    let _timeout = QTRRCDefaultTimeout

    let QTRMaxSensors = 31
    let _sensorPins: number[] = []

    let _sensorCount = 0

    let _samplesPerSensor = 4

    let _oddEmitterPin = QTRNoEmitterPin // also used for single emitter pin
    let _evenEmitterPin = QTRNoEmitterPin
    let _emitterPinCount = 0

    let _dimmable = true
    let _dimmingLevel = 0

    let _lastPosition = 0

    let calibrationOn_maximum: number[] = []
    let calibrationOn_minimum: number[] = []
    let calibrationOff_maximum: number[] = []
    let calibrationOff_minimum: number[] = []

    let calibration_maximum: number[] = []
    let calibration_minimum: number[] = []

    let sensorValues:number[] = []

    let Sensors: ADC[] = [ADC.ADC0, ADC.ADC1, ADC.ADC2, ADC.ADC3, ADC.ADC4, ADC.ADC5, ADC.ADC6, ADC.ADC7]

    /**ReadADC for read analog sensor, Select ADC channel 0-7.
          *
          */
    //% blockId="LineRobot_readADC" block="Read %LineRobotReadADC"
    //% weight=60
    export function ReadADC(ReadADC: ADC): number {
        let ADCValue: number

        pins.i2cWriteNumber(
            72,
            ReadADC,
            NumberFormat.UInt8LE,
            false
        )
        return ReadADC = pins.i2cReadNumber(72, NumberFormat.UInt16BE, false)
    }
//////////////////////////////////////////////////////////////////////////////////
    /**ตั้งค่าเริ่มต้น จำนวนเซนเซอร์  
          * @param numSensors percent of maximum NSensors, eg: 5
          */
    //% blockId="PidRobot_ตั้งค่า" block="ตั้งค่า | จำนวนเซ็นเซอร์ %numSensors"
    //% numSensors.min=1 numSensors.max=8
    //% weight=100

    export function setSensors(numSensors: number): void{
        _sensorCount = numSensors
        setTypeAnalog()
    }

    function setTypeRC(): void
    {
        _type = "RC"
        _maxValue = _timeout
    }

    function setTypeAnalog(): void
    {
        _type = "Analog"
        _maxValue = 4096 // Arduino analogRead() returns a 12-bit value by default
        for (let z = 0; z < _sensorCount; z++) {
            calibration_maximum[z] = 0
            calibration_minimum[z] = _maxValue
        }
    }

    function setTimeout(timeout: number): void
    {
        if (timeout > 32767) { timeout = 32767 }
        _timeout = timeout
        if (_type == "RC") { _maxValue = timeout }
    }

    function setSamplesPerSensor(samples: number): void
    {
        if (samples > 64) { 
            samples = 64 
        }
        _samplesPerSensor = samples
    }

    function setDimmingLevel(dimmingLevel: number): void
    {
        if (dimmingLevel > 31) { 
            dimmingLevel = 31 
        }
        _dimmingLevel = dimmingLevel
    }

    /**calibrate
      */
    //% help=math/map weight=10 blockGap=8
    //% //% blockId="PidRobot_calibrate" block="calibrate"
    //% inlineInputMode=inline
    //% weight=90
    export function calibrate(): void
    {
        calibrateOnOrOff()
    }

    function calibrateOnOrOff(): void
    {
        //let sensorValues: number[] = []
        let maxSensorValues: number[] = []
        let minSensorValues: number[] = []

        for (let j = 0; j < 10; j++)
        {
            read()

            for (let i = 0; i < _sensorCount; i++)
            {
                // set the max we found THIS time
                if ((j == 0) || (sensorValues[i] > maxSensorValues[i])) {
                    maxSensorValues[i] = sensorValues[i]
                }

                // set the min we found THIS time
                if ((j == 0) || (sensorValues[i] < minSensorValues[i])) {
                    minSensorValues[i] = sensorValues[i]
                }
            }
        }

        // record the min and max calibration values
        for (let i = 0; i < _sensorCount; i++)
        {
            // Update maximum only if the min of 10 readings was still higher than it
            // (we got 10 readings in a row higher than the existing maximum).
            if (minSensorValues[i] > calibration_maximum[i]) {
                calibration_maximum[i] = minSensorValues[i]
            }

            // Update minimum only if the max of 10 readings was still lower than it
            // (we got 10 readings in a row lower than the existing minimum).
            if (maxSensorValues[i] < calibration_minimum[i]) {
                calibration_minimum[i] = maxSensorValues[i]
            }
        }
    }

    function read(): void{
        readPrivate()
    }

    function readCalibrated(): void{
        // read the needed values
        read()

        for (let i = 0; i < _sensorCount; i++)
        {
            let calmin, calmax

            calmax = calibration_maximum[i]
            calmin = calibration_minimum[i]
            
            let denominator = calmax - calmin
            let value = 0

            if (denominator != 0) {
                value = ((sensorValues[i]) - calmin) * 1000 / denominator
            }

            if (value < 0) { 
                value = 0 
            }
            else if (value > 1000) { 
                value = 1000 
            }

            sensorValues[i] = value
        }
    }

    // Reads the first of every [step] sensors, starting with [start] (0-indexed, so
    // start = 0 means start with the first sensor).
    // For example, step = 2, start = 1 means read the *even-numbered* sensors.
    // start defaults to 0, step defaults to 1
    function readPrivate(): void{
        // reset the values
        for (let i = 0; i < _sensorCount; i += 1)
        {
            sensorValues[i] = 0
        }

        for (let j = 0; j < _samplesPerSensor; j++)
        {
            for (let i = 0; i < _sensorCount; i += 1)
            {
                // add the conversion result
                sensorValues[i] += ReadADC(Sensors[i])
            }
        }

        // get the rounded average of the readings for each sensor
        for (let i = 0; i < _sensorCount; i += 1)
        {
            sensorValues[i] = (sensorValues[i] + (_samplesPerSensor >> 1)) / _samplesPerSensor
        }
        return
    }

    function readLinePrivate(invertReadings:boolean): number{
        let onLine = false
        let avg = 0 // this is for the weighted total
        let sum = 0 // this is for the denominator, which is <= 64000

        readCalibrated()

        for (let i = 0; i < _sensorCount; i++)
        {
            let value = sensorValues[i]

            //ถ้าเป็นเส้นสีขาว
            if (invertReadings) { 
                value = 1000 - value 
            }

            // keep track of whether we see the line at all
            if (value > 200) { 
                onLine = true 
            }

            // only average in values that are above a noise threshold
            if (value > 50) {
                avg += value * (i * 1000)
                sum += value
            }
        }

        if (!onLine) {
            // If it last read to the left of center, return 0.
            if (_lastPosition < (_sensorCount - 1) * 1000 / 2) {
                return 0
            }
            // If it last read to the right of center, return the max.
            else {
                return (_sensorCount - 1) * 1000
            }
        }

        _lastPosition = avg / sum
        return _lastPosition
    }
    /**readLineBlack
          */
    //% help=math/map weight=10 blockGap=8
    //% //% blockId="PidRobot_readLineBlack" block="readLineBlack"
    //% inlineInputMode=inline
    //% weight=80
    export function readLineBlack(): number
    {
        return readLinePrivate(false)
    }
    /**readLineBlack
              */
    //% help=math/map weight=10 blockGap=8
    //% //% blockId="PidRobot_readLineWhite" block="readLineWhite"
    //% inlineInputMode=inline
    //% weight=80
    export function readLineWhite(): number
    {
        return readLinePrivate(true)
    }

}
