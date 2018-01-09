# -*- coding: utf-8 -*-
""" A wrapper class for PySerial adapting it for easier communication with FTDI USB serial ttys.

See the PySerial Documentation: http://pyserial.readthedocs.io/en/latest/pyserial_api.html
"""

from subprocess import call, Popen, PIPE, TimeoutExpired
from getpass import getpass
import serial
import re
import sys
import os

nul = open(os.devnull, 'w')


class ReadTerminal:
    """ Provide USB serial TTY connection to a micro-controller device. """
    def __init__(self, regex='^\}$', tty='/dev/ttyACM0', baud=230400, su_pass=''):
        """
        :param regex: Assuming your device sends back JSON, this regex matches the closing curly brace.
        :param tty: Path to the tty device.
        :param baud: Baud rate.
        """
        self.regex = re.compile(regex)
        self.tty = tty
        self.baud = baud
        self.su_pass = su_pass
        f_flag = ''
        if sys.platform.startswith('linux') or sys.platform.startswith('darwin'):
            from os import getuid
            if sys.platform.startswith('linux'):
                f_flag = '-F'
            elif sys.platform.startswith('darwin'):
                f_flag = '-f'
            if not getuid() == 0:
                try:
                    if self.su_pass is '':
                        self.su_pass = getpass("Setting terminal characteristics requires sudo password: ")
                    password = ''.join([self.su_pass, '\n'])
                    proc = Popen(['sudo', '-k', '-p', '', '-S', 'stty', f_flag, self.tty, 'sane'],
                                 stdin=PIPE, stdout=PIPE, stderr=PIPE, encoding='utf-8', universal_newlines=True)
                    try:
                        output, errors = proc.communicate(input=password, timeout=3)
                        proc.terminate()
                        if proc.returncode is not 0:
                            print(errors, file=sys.stderr, flush=True)
                            exit(1)
                    except TimeoutExpired:
                        proc.kill()
                        print(errors, file=sys.stderr, flush=True)
                        exit(1)

                    proc = Popen(['sudo', '-k', '-p', '', '-S', 'stty', f_flag, self.tty, 'cs8', str(self.baud),
                                  'ignbrk', '-brkint', '-imaxbel', '-opost', '-onlcr', '-isig', '-icanon', '-iexten',
                                  '-echo', '-echoe', '-echok', '-echoctl', '-echoke', 'noflsh', '-ixon', '-crtscts'],
                                 stdin=PIPE, stdout=PIPE, stderr=PIPE, encoding='utf-8', universal_newlines=True)
                    try:
                        output, errors = proc.communicate(input=password, timeout=3)
                        proc.terminate()
                        if proc.returncode is not 0:
                            print(errors)
                            exit(1)
                    except TimeoutExpired:
                        proc.kill()
                        print(errors)
                        exit(1)

                except OSError as e:
                    print(e.strerror.split(sep="'")[0], self.tty, file=sys.stderr, flush=True)
                    exit(1)
            else:
                try:
                    call(' '.join(['stty', f_flag, tty, 'sane']))
                    call(' '.join(['stty', f_flag, tty, 'cs8', repr(self.baud), 'ignbrk -brkint -imaxbel '
                           '-opost -onlcr -isig -icanon -iexten -echo -echoe -echok -echoctl -echoke '
                           'noflsh -ixon -crtscts']))
                except OSError as e:
                    print(e.strerror.split(sep="'")[0], self.tty, file=sys.stderr, flush=True)
                    exit(1)
        elif sys.platform.startswith('win32'):
            try:
                call(''.join(['C:\Windows\System32\mode.com ', self.tty, ' baud=', repr(self.baud),
                              ' parity=n data=8 stop=1 dtr=on rts=on to=off xon=off odsr=off octs=off idsr=off']),
                     stdout=nul, stderr=nul)
            except OSError as e:
                print(e.strerror, self.tty, file=sys.stderr, flush=True)
                exit(1)
        try:
            self.dev = serial.Serial(self.tty, self.baud)
        except OSError as e:
            if e.errno == 2:
                print(e.strerror, file=sys.stderr, flush=True)
                exit(1)
        # Drain the buffer of any crufty data it may hold.
        while self.in_waiting() > 0:
            self.dev.read()

    def open(self):
        """ Wrapper for Serial.open. """
        if not self.dev.is_open:
            self.dev.open()

    def read(self):
        """ Wrapper for Serial.readline. """
        return self.dev.readline().decode()

    def in_waiting(self):
        """ Wrapper for Serial.in_waiting. """
        return self.dev.inWaiting()

    def close(self):
        """ Wrapper for Serial.close. """
        self.dev.close()


