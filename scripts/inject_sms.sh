#!/system/bin/sh
NOW=$(date +%s000)

# Use no-space format to avoid argument parsing issues
content insert --uri content://sms/inbox --bind address:s:10655551234 --bind date:l:$NOW --bind read:i:0 --bind body:s:【菜鸟驿站】取件码5362已到阳光花园小区菜鸟驿站电话13812345678

content insert --uri content://sms/inbox --bind address:s:10698888666 --bind date:l:$NOW --bind read:i:0 --bind body:s:【圆通速递】取件码8391已到翠苑新村妈妈驿站电话13987654321

content insert --uri content://sms/inbox --bind address:s:10655559999 --bind date:l:$NOW --bind read:i:0 --bind body:s:【丰巢】取件码7421丰巢智能柜银河大厦B1层电话13788889999

content insert --uri content://sms/inbox --bind address:s:10651111000 --bind date:l:$NOW --bind read:i:0 --bind body:s:【极兔速递】取件码1593存放于龙湖天街快递超市电话13612348765

echo "Done: 4 SMS injected"
