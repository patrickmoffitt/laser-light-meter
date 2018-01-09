#!/usr/bin/env python3
# -*- coding: utf-8 -*-
""" Train a SciKitLearn K Nearest Neighbors classifier using sample data. """

import json
import sys
from math import pow, floor
from os import path, getcwd
import numpy as np
import pwm_wave_lib as pwlib
from sklearn.neighbors import KNeighborsClassifier
from sklearn.externals import joblib
from sklearn.datasets.base import Bunch
from sklearn.model_selection import cross_val_score
import re
from glob import glob
import argparse

parser = argparse.ArgumentParser()

parser.add_argument('-d', '--directory', default=getcwd(),
                    help='Path to model training samples. Defaults to current directory.')
args = parser.parse_args()

data = []
target = []
samples = glob(''.join([args.directory, '/??_duty/serial??.json']))
no_samples = 1
end = len(samples)


def status_update(filename, no_samples, end):
    """ Return a status update message. """
    head, tail = path.split(filename)
    directory = path.basename(head)
    percent_complete = repr(floor(round(no_samples / end, 2) * 100))
    return ''.join([percent_complete, '% complete. ', directory, '/', tail])


print()
print('┌──────────────────────┐')
print('│ Begin Model Training │')
print('└──────────────────────┘\n', flush=True)

for filename in samples:
    if path.isfile(filename):
        json_data = json.loads(open(filename).read())
        if hasattr(json_data, 'values'):
            p = re.search('([\d]{2})_duty', path.dirname(filename))
            target.append(int(p.group(1)))
            limits = pwlib.get_minima(json_data)
            volts = np.asarray([round(v, 4) for v in json_data['values'][limits[0]:limits[1]]])
            histogram = np.histogram(volts, bins=3, range=(volts.min(), volts.min() + 0.05))
            data.append((histogram[0][0], histogram[0][1]))
        else:
            print('Extracted JSON data has no attribute "values".', file=sys.stderr, flush=True)
    else:
        print(filename, 'is not a regular file.', file=sys.stderr, flush=True)
    print(status_update(filename, no_samples, end), flush=True)
    no_samples += 1


if len(data) is 0 or len(target) is 0:
    print('Data array collection error: no data found.', file=sys.stderr, flush=True)
    exit(1)

X = np.asarray(data)
y = np.asarray(target)

samples = Bunch()
samples.data = data
samples.target = target
samples_file = path.join(args.directory, 'poly2d.pkl.xz')
joblib.dump(samples, samples_file)

cv_neighbors = 5
knn = KNeighborsClassifier(n_neighbors=cv_neighbors, n_jobs=-1)
knn.fit(X, y)
model_file = path.join(args.directory, 'knn_model.pkl.xz')
joblib.dump(knn, model_file)

cv_folds = 5
try:
    scores = cross_val_score(knn, X, y, cv=cv_folds)
except ValueError as e:
    message = 'Error computing cross_val_score.'
    print(message, e, file=sys.stderr, flush=True)
    exit(1)


sum_sq = 0
p = knn.predict(X)
for guess, target in zip(p, y):
    sum_sq += pow(guess - target, 2)

standard_error_estimate = sum_sq / len(X)

output = json.JSONEncoder().encode({
    'cross-validation-accuracy': scores.mean(),
    'cross-validation-error': scores.std(),
    'cross-validation-neighbors': cv_neighbors,
    'cross-validation-folds': cv_folds,
    'standard-error-estimate': standard_error_estimate,
    'samples': samples_file,
    'model': model_file})

print()
print(output, flush=True)
