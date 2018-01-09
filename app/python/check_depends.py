#!/usr/bin/env python3
# -*- coding: utf-8 -*-
""" Attempt to import module dependencies and report errors. """

import sys

try:
    import numpy
    import matplotlib
    import paramiko
    import scipy
    import sklearn
    import serial
except ModuleNotFoundError as e:
    print('Please install the following required Python modules; numpy, matplotlib,'
          ' paramiko, scipy, sklearn, and pyserial.', file=sys.stderr, flush=True)
    exit(1)
