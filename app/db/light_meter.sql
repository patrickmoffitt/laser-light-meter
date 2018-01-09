CREATE TABLE "laser-host" (
	 "host-id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	 "hostname" TEXT NOT NULL,
	 "ip-address" TEXT NOT NULL,
	 "rcmd-user" TEXT
);
CREATE TABLE "operator" (
	 "operator-id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	 "username" TEXT NOT NULL
);
CREATE TABLE "meter" (
	 "meter-id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
	 "meter-name" text NOT NULL,
	 "meter-new-date" integer,
	 "sample-rate-khz" integer NOT NULL DEFAULT 77,
	 "meter-description" text
);
CREATE TABLE "laser" (
	 "laser-id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
	 "laser-host-id" integer NOT NULL,
	 "power-rating-mw" integer NOT NULL,
	 "beam-frequency-nm" integer NOT NULL,
	 "laser-new-date" integer NOT NULL,
	 "laser-refurb-date" integer DEFAULT 0,
	 "laser-description" text NOT NULL,
	CONSTRAINT "laser-host-id" FOREIGN KEY ("laser-host-id") REFERENCES "laser-host" ("host-id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "model" (
	 "model-id" INTEGER NOT NULL,
	 "laser-id" INTEGER NOT NULL,
	 "meter-id" INTEGER NOT NULL,
	 "operator-id" INTEGER NOT NULL,
	 "laser-host-id" INTEGER NOT NULL,
	 "model-host-name" text NOT NULL,
	 "min-duty" integer NOT NULL,
	 "max-duty" integer NOT NULL,
	 "series" integer NOT NULL,
	 "cross-validation-accuracy" real NOT NULL,
	 "cross-validation-error" real NOT NULL,
	 "cross-validation-neighbors" integer NOT NULL,
	 "cross-validation-folds" integer NOT NULL,
	 "standard-error-estimate" real NOT NULL,
	 "samples" string NOT NULL,
	 "model" string NOT NULL,
	PRIMARY KEY("model-id"),
	CONSTRAINT "meter-id" FOREIGN KEY ("meter-id") REFERENCES "meter" ("meter-id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "operator-id" FOREIGN KEY ("operator-id") REFERENCES "operator" ("operator-id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "laser-host-id" FOREIGN KEY ("laser-host-id") REFERENCES "laser-host" ("host-id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "laser-id" FOREIGN KEY ("laser-id") REFERENCES "laser" ("laser-id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "compare" (
	 "sample-model-id" INTEGER NOT NULL,
	 "knn-model-id" INTEGER NOT NULL,
	 "operator-id" INTEGER NOT NULL,
	 "host-name" text NOT NULL,
	 "date" integer NOT NULL,
	 "error-proba-mean" real NOT NULL,
	 "error-proba-std-dev" real NOT NULL,
	 "error-proba-std-err-mean" real NOT NULL,
	 "error-proba-variance" real NOT NULL,
	 "error-proba-bins" integer NOT NULL,
	 "prediction-score" real NOT NULL,
	 "std-err-estimate" real NOT NULL,
	 "predict-proba" text NOT NULL,
	 "proba-dist-chart" TEXT NOT NULL,
	 "mean-variance-chart" TEXT NOT NULL,
	CONSTRAINT "sample-model-id" FOREIGN KEY ("sample-model-id") REFERENCES "model" ("model-id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "knn-model-id" FOREIGN KEY ("knn-model-id") REFERENCES "model" ("model-id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "operator-id" FOREIGN KEY ("operator-id") REFERENCES "operator" ("operator-id") ON DELETE CASCADE ON UPDATE CASCADE
);
