#!/usr/bin/env python3
# -*- coding: utf-8 -*-
""" Detect duty cycle values in sample data using a model previously trained on the same laser. """

from os import path, getcwd, listdir
from platform import node
from json import JSONEncoder
import time
import sys
import argparse
from datetime import datetime
from math import floor, pow
import numpy as np
from sklearn.externals import joblib
from scipy import stats
import re
import matplotlib.mlab as mlab
import matplotlib.pyplot as plt


parser = argparse.ArgumentParser()

parser.add_argument('model_id', help='Model ID number for the model.')
parser.add_argument('sample_id', help='Model ID number for the sample.')
parser.add_argument('operator_id', help='Operator ID number for the person running the prediction.')
parser.add_argument('-d', '--directory', default=getcwd(),
                    help="Base directory for the models. Defaults to current directory.")
parser.add_argument('--host', default=node(),
                    help="The local hostname. Defaults to the local hostname.")
args = parser.parse_args()

""" Retrieve the stored model and sample data. """
model_file = path.join(args.directory, args.model_id, 'knn_model.pkl.xz')
sample_file = path.join(args.directory, args.sample_id, 'poly2d.pkl.xz')

for file in [model_file, sample_file]:
    if not path.isfile(file):
        print('Error:', file, 'is not a valid file.', file=sys.stderr, flush=True)
        exit(1)

try:
    knn = joblib.load(model_file)
except KeyError as e:
    print('Error:', model_file, 'is not a valid model.', file=sys.stderr, flush=True)
    exit(1)

try:
    samples = joblib.load(sample_file)
    X = np.asarray(samples.data)
    y = np.asarray(samples.target)
except KeyError as e:
    print('Error:', sample_file, 'is not a valid sample.', file=sys.stderr, flush=True)
    exit(1)

predict = knn.predict(X)              # Predict the class labels for the provided data.
predict_proba = knn.predict_proba(X)  # Return probability estimates for the test data.
score = knn.score(X, y)               # Returns the mean accuracy on the given test data and labels.

predict_proba_file = ''.join([
    args.directory, path.sep,
    args.model_id, path.sep,
    'predict_proba_',
    args.sample_id,
    '_data_by_',
    args.model_id,
    '_model.pkl.xz'])
joblib.dump(predict_proba, predict_proba_file)

""" Chart probability distribution. """
title = ' '.join([
    datetime.fromtimestamp(int(args.sample_id)).strftime('%Y-%m-%d %H:%M %p'),
    'data by',
    datetime.fromtimestamp(int(args.model_id)).strftime('%Y-%m-%d %H:%M %p'),
    'model.'])


def get_range(directory):
    """ Determine the range for the samples by inspecting the samples directory. """
    regex = '[\d]{2}_duty'
    sub_dirs = sorted([f for f in listdir(directory) if path.isdir(path.join(directory, f)) and re.match(regex, f)])
    min_range = sub_dirs[0].split('_')[0]
    max_range = sub_dirs[len(sub_dirs) - 1].split('_')[0]
    return range(int(min_range), int(max_range) + 1)


series = list(get_range(path.join(args.directory, args.sample_id)))
values = np.sum(predict_proba, axis=0)
plt.plot(series, values, label='Probability')
plt.title('Probability Distribution')
z = np.polyfit(series, values, 1)
p = np.poly1d(z)
coef = z.tolist()
plt.plot(series, p(series), label='\n'.join(map(repr, coef)))
plt.ylabel('Sum')
plt.xlabel('\n'.join(['Category', title]))
plt.axis([20, 80, 20, 80])
plt.legend(loc='upper right')
prob_dist_file = ''.join([
    args.directory, path.sep,
    args.model_id, path.sep,
    'prob_dist_',
    args.sample_id,
    '_data_by_',
    args.model_id,
    '_model.svg'])
plt.tight_layout()
plt.savefig(prob_dist_file, papertype='letter', orientation='landscape')

""" Chart mean variance histogram. """
hist, axh = plt.subplots()
hist.subplots_adjust(bottom=0.2)
a = predict_proba.sum(axis=0)
var = np.var(a, axis=0)
mu = a.mean(axis=0)    # mean of distribution
sigma = a.std(axis=0)  # standard deviation of distribution
sem = stats.sem(a, axis=None, ddof=0)
# the histogram of the data
n, bins, patches = axh.hist(a, bins='auto', normed=1)
no_bins = len(bins)
# add a 'best fit' line
y = mlab.normpdf(bins, mu, sigma)
axh.plot(bins, y, '--', color='orange', label='Sigma')
# add sem line
r = mlab.normpdf(bins, mu, sem)
axh.plot(bins, r, '--', color='red', label='SEM')
axh.set_xlabel('\n'.join(['Variation about the Mean', title]))
axh.set_ylabel('Probability Density')
axh.set_title(r'Histogram: $\mu=$%0.2f, $\sigma=$%0.2f, bins=%2u, sem=%0.2f, var=%0.2f'
              % (mu, sigma, no_bins, sem, var))
plt.legend(loc='upper right')
hist_file = ''.join([
    args.directory, path.sep,
    args.model_id, path.sep,
    'mean_variance_',
    args.sample_id,
    '_data_by_',
    args.model_id,
    '_model.svg'])
plt.savefig(hist_file, papertype='letter', orientation='landscape')


sum_sq = 0
for guess, target in zip(predict, y):
    sum_sq += pow(guess - target, 2)

std_err_estimate = sum_sq / len(X)

output = JSONEncoder().encode({
    'sample-model-id': args.sample_id,
    'knn-model-id': args.model_id,
    'operator-id': args.operator_id,
    'host-name': args.host.split('.')[0],
    'date': floor(time.time()),
    'error-proba-mean': mu,
    'error-proba-std-dev': sigma,
    'error-proba-std-err-mean': sem,
    'error-proba-variance': var,
    'error-proba-bins': no_bins,
    'predict-proba': predict_proba_file,
    'prediction-score': score,
    'std-err-estimate': std_err_estimate,
    'proba-dist-chart': prob_dist_file,
    'mean-variance-chart': hist_file})

print()
print(output, flush=True)

