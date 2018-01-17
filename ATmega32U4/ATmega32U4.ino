//
//  Created by Patrick Moffitt on 5/17/17.
//  Copyright © 2017 Patrick Moffitt. All rights reserved.
//
#include <ring_buffer.h>
#include <util/atomic.h>
#include <limits.h>

const int meterId = 1;
const byte interruptPinStart = 2;
// const byte interruptPinEnd= 3;
int voltagePin = A0;
int voltageValue = 0;
volatile unsigned long counter = 0;

volatile unsigned long startTime = 0;
volatile unsigned long endTime = 0;

double sampleDuration = 0;
int startSample = 0;
int ringSample = 0;

double sampleRateKHz = 0;
double getSampleRate();

volatile unsigned long sampleStartValue = 0;
void sampleStart();

volatile unsigned long sampleEndValue = 0;
void sampleEnd();

unsigned long sampleSize();

void dataReset();
double byte2Voltage(byte voltage);
double byte2Float(byte voltage);
const int ringSize = 1000;

volatile bool hasStarted = false;
volatile bool hasEnded = false;

struct Datum
{
	byte voltage = 0;
};

Datum data[ringSize];
Ring_buffer<Datum>dataBuffer(data);

void setup()
{
  Serial.begin(230400);
  pinMode(interruptPinStart, INPUT);
  // pinMode(interruptPinEnd, INPUT);
  attachInterrupt(digitalPinToInterrupt(interruptPinStart), sampleStart, FALLING);
  // attachInterrupt(digitalPinToInterrupt(interruptPinEnd), sampleEnd, RISING);
  pinMode(A0, INPUT);

  ADCSRA = 0;               // Clear ADCSRA register.
  ADCSRB = 0;               // Clear ADCSRB register.
  ADMUX |= (0 & 0x07);      // Set analog input pin to A0.
  ADMUX |= (1 << REFS0);    // Set reference voltage.
  ADMUX |= (1 << ADLAR);    // Left align ADC value to 8 bits from ADCH register.

  // Sampling rate is [ADC clock] / [prescaler] / [conversion clock cycles]
  // For Arduino Uno ADC clock is 16 MHz and a conversion takes 13 clock cycles
  // ADCSRA |= (1 << ADPS2) | (1 << ADPS0);       // 32 prescaler for 38.5 KHz
  ADCSRA |= (1 << ADPS2);                         // 16 prescaler for 76.9 KHz
  // ADCSRA |=   (1  <<  ADPS1) | (1  <<  ADPS0); // 8 prescaler for 153.8 KHz
  // ADCSRA |=  (1 << ADPS1);                     // 4 prescaler for 307 KHz
  // ADCSRA |=  (1 << ADPS0);                     // 2 prescaler for 615 KHz

  ADCSRA |= (1 << ADATE);   // Enable auto trigger.
  ADCSRA |= (1 << ADIE);    // Enable interrupts when measurement complete.
  ADCSRA |= (1 << ADEN);    // Enable ADC.
  ADCSRA |= (1 << ADSC);    // Start ADC measurements.
}


ISR(ADC_vect)
{
  // Write ADCH into the ring buffer.
  counter++;
  Datum measurement;
  measurement.voltage = ADCH;  // read 8 bit value from ADC
  dataBuffer.write(measurement);
  if ( hasStarted == true ) {
    if ( ringSample == 950 ) {
      sampleEnd();
    } else {
      ringSample++;
    }
  }
  // Serial.print( String(counter, DEC) + " " + String(byte2Voltage(measurement.voltage)) + "\n" ); // REMOVE
}

void loop()
{
}

void sampleStart()
{
  if ( hasStarted == true ) { return; }
  //  Serial.print( String("Sample start.\n") );  // REMOVE
  startTime = micros();
  sampleStartValue = counter;
  hasStarted = true;
  hasEnded = false;
}

void sampleEnd()
{
  if( hasStarted == false || hasEnded == true ) { return; }
	hasEnded = true;
  endTime = micros();
  sampleEndValue = counter;
	sampleRateKHz = getSampleRate();
	sampleDuration = (endTime - startTime) * 0.001;
	startSample = ringSize - sampleSize();
  // Write a JSON format data object to the tty.
  // Serial.print( String( "{\n  \042values\042: [\n    " ) + String(byte2Voltage(dataBuffer.peek().voltage), 4) );
	ATOMIC_BLOCK(ATOMIC_RESTORESTATE)
	{
		Serial.print( String( "    \n    \n" )
		+ String( "\n{\n  \042values\042: [\n    1.0000" ) );
    dataBuffer.each([&](const Datum&m)
    // while( !dataBuffer.is_empty() )
      {
  	    Serial.print( String( ",\n    " )  + String(byte2Float(m.voltage), 4) );
        // Serial.print( String( ",\n    " )  + String(byte2Voltage(dataBuffer.read().voltage), 4) );
      }
    );
    Serial.print( String("\n  ],\n  \042sample_size\042: ")
		+ String( sampleSize() , DEC )
		+ ",\n  \042ring_size\042: " + ringSize + ",\n  \042start_sample\042: "
		+ String( startSample, DEC ) + ",\n" + String("  \042sample_rate_khz\042: ")
		+ String(sampleRateKHz, 4) + ",\n  \042sample_duration_ms\042: "
		+ String( sampleDuration, 4 ) + ",\n  \042meter_id\042: "
		+ String( meterId, DEC )
		+ "\n}\n"  );
		Serial.flush();
	}
  // Reset and continue.
  dataReset();
}

double byte2Voltage(byte voltage)
{
  return voltage * (5.0 / 255.0);
}

double byte2Float(byte voltage)
{
  return voltage * (1.0 / 255.0);
}

void dataReset()
{
  counter = 0;
  sampleStartValue = 0;
  sampleEndValue = 0;
  ringSample = 0;

  startTime = 0;
  endTime = 0;
  sampleDuration = 0;
  sampleRateKHz = 0;

  dataBuffer.clear();
  dataBuffer.align();
  hasStarted = false;
}

double getSampleRate()
{
  return ( (float) sampleSize() / (float)  ( (endTime - startTime) * 0.001) );
}

unsigned long sampleSize()
{
  if (sampleEndValue > sampleStartValue ) {
      return (sampleEndValue - sampleStartValue) ;
  } else {
      return ( ULONG_MAX - ( sampleStartValue - sampleEndValue ) );
  }
}
