QTRSensors.setSensors(4)
basic.showIcon(IconNames.Heart)
for (let index = 0; index < 100; index++) {
    QTRSensors.calibrate()
}
basic.showIcon(IconNames.SmallHeart)
basic.forever(function () {
    serial.writeLine("" + (QTRSensors.readLineBlack()))
})
